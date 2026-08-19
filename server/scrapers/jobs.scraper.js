import axios from "axios";
import * as cheerio from "cheerio";
import Job from "../models/Job.js";
import JobSearch from "../models/JobSearch.js";
import { extractExperience } from "./experience.js";
import { normalizeEmploymentType, detectEmploymentTypeFromText } from "./employmentType.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const HEADERS = { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9" };

// LinkedIn's logged-out "see more jobs" endpoint returns a chunk of job-card
// HTML at a given offset. It answers a plain HTTP GET, so this scraper needs
// no browser at all — Puppeteer is still used by the apply flow, which needs a
// real session.
const GUEST_SEARCH_API =
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";

const PAGE_STEP = 9; // < the ~10 cards a page returns, so windows overlap and never skip
const PAGE_CONCURRENCY = 4; // pages in flight while paginating
const DETAIL_CONCURRENCY = 4; // detail pages in flight while reading experience
const REQUEST_TIMEOUT_MS = 25000;
const MAX_JOBS = 400; // safety ceiling per search — a week of one keyword
const MAX_PAGES = 80; // hard stop in case the offset never empties
const STALE_LIMIT = 2; // stop after N batches that add nothing new

// Reading a detail page per job is the expensive half of a scrape, so it runs
// on a budget: newest jobs first, and whatever doesn't fit is picked up by the
// next run. Untagged jobs still show in the feed, just without a range.
const MAX_DETAIL_FETCHES = 120;
const ENRICH_BUDGET_MS = 60000;

// Request pacing. Concurrency alone got this IP a 429 within seconds — what
// LinkedIn actually cares about is the request *rate*, so every request passes
// through one adaptive gap that widens on throttling and relaxes on success.
const BASE_GAP_MS = 300;
const MAX_GAP_MS = 2500;
const MAX_RETRIES = 2;

let gapMs = BASE_GAP_MS;
let nextSlotAt = 0;
let throttleHits = 0;

// Only one scrape at a time — cron and the on-demand trigger share this.
let busy = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Reserve the next slot in the request stream, then wait for it.
async function pace() {
  const now = Date.now();
  const slot = Math.max(now, nextSlotAt);
  nextSlotAt = slot + gapMs;
  if (slot > now) await sleep(slot - now);
}

function slowDown(retryAfterHeader) {
  throttleHits += 1;
  const retryAfter = Number(retryAfterHeader) * 1000;
  gapMs = Number.isFinite(retryAfter) && retryAfter > 0
    ? Math.min(Math.max(retryAfter, gapMs * 2), MAX_GAP_MS)
    : Math.min(gapMs * 2, MAX_GAP_MS);
}

// Recover on every success, not after a long clean streak — one early 429
// should not leave the whole run crawling at the maximum gap.
function speedUp() {
  if (gapMs > BASE_GAP_MS) gapMs = Math.max(BASE_GAP_MS, Math.round(gapMs * 0.85));
}

// Run tasks with a fixed number in flight, preserving input order.
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

function buildGuestUrl(keywords, location, start) {
  const params = new URLSearchParams({
    keywords,
    location: location || "",
    f_TPR: "r604800", // posted within the last week — widest filter the app offers
    start: String(start),
  });
  // Deliberately no f_E (experience) filter: on the guest endpoint it leaks
  // badly — "internship" and "executive" searches returned 20 of the same 30
  // jobs — and it would also drop postings that never state a level, which the
  // feed is supposed to keep. Experience is parsed from the description and
  // filtered in the API instead.
  return `${GUEST_SEARCH_API}?${params.toString()}`;
}

function parsePostedDate(iso, text) {
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const m = /(\d+)\s+(minute|hour|day|week|month)/i.exec(text || "");
  if (m) {
    const unitMs = {
      minute: 60e3,
      hour: 3600e3,
      day: 86400e3,
      week: 7 * 86400e3,
      month: 30 * 86400e3,
    }[m[2].toLowerCase()];
    return new Date(Date.now() - Number(m[1]) * unitMs);
  }
  return new Date();
}

class BlockedError extends Error {}

// Fetch one page, waiting its turn in the paced request stream. A throttled
// request backs off and retries rather than failing the whole scrape.
async function getHtml(url) {
  for (let attempt = 0; ; attempt++) {
    await pace();
    const res = await axios.get(url, {
      headers: HEADERS,
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
      maxRedirects: 5,
    });

    if (res.status === 429 || res.status === 403) {
      slowDown(res.headers?.["retry-after"]);
      if (attempt >= MAX_RETRIES) throw new BlockedError(`HTTP ${res.status}`);
      await sleep(gapMs * (attempt + 1));
      continue;
    }
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);

    const finalUrl = res.request?.res?.responseUrl || url;
    if (/authwall|\/login|\/checkpoint/.test(finalUrl)) throw new BlockedError("auth wall");

    speedUp();
    return String(res.data || "");
  }
}

function parseCards(html) {
  const $ = cheerio.load(html);
  const out = [];
  $("li").each((_, li) => {
    const card = $(li);
    const text = (sel) => card.find(sel).first().text().trim();
    const time = card.find("time").first();
    const href =
      card.find("a.base-card__full-link").first().attr("href") ||
      card.find("a").first().attr("href") ||
      "";
    const title = text("h3.base-search-card__title");
    if (!title || !href) return;
    out.push({
      title,
      company: text("h4.base-search-card__subtitle") || "Unknown",
      location: text("span.job-search-card__location"),
      // strip tracking params so the same posting always dedupes to one URL
      url: href.split("?")[0],
      postedAt: parsePostedDate(
        time.attr("datetime") || "",
        time.text().trim()
      ),
      postedText: time.text().trim(),
    });
  });
  return out;
}

// Walk the guest endpoint in overlapping batches until it stops yielding new
// postings. Throws only if the very first batch is blocked; a block part-way
// through keeps whatever was already collected.
export async function collectListings(keywords, location) {
  const byUrl = new Map();
  let start = 0;
  let stale = 0;
  let pages = 0;

  while (byUrl.size < MAX_JOBS && pages < MAX_PAGES && stale < STALE_LIMIT) {
    const offsets = Array.from(
      { length: PAGE_CONCURRENCY },
      (_, i) => start + i * PAGE_STEP
    );

    const batch = await mapLimit(offsets, PAGE_CONCURRENCY, async (offset) => {
      try {
        return parseCards(await getHtml(buildGuestUrl(keywords, location, offset)));
      } catch (err) {
        if (err instanceof BlockedError) throw err;
        console.warn(`[jobs] page at start=${offset} failed: ${err.message}`);
        return [];
      }
    }).catch((err) => {
      if (err instanceof BlockedError && byUrl.size === 0) throw err;
      console.warn(`[jobs] blocked (${err.message}) after ${byUrl.size} jobs — stopping early`);
      return null;
    });

    if (batch === null) break;
    pages += offsets.length;

    const before = byUrl.size;
    for (const card of batch.flat()) {
      if (!byUrl.has(card.url)) byUrl.set(card.url, card);
    }

    // an all-empty batch means we walked past the end of the result set
    if (batch.every((cards) => cards.length === 0)) break;
    stale = byUrl.size === before ? stale + 1 : 0;
    start += PAGE_CONCURRENCY * PAGE_STEP;
  }

  return [...byUrl.values()].slice(0, MAX_JOBS);
}

// Read the detail page for its stated experience requirement and seniority.
// Returns null when the page can't be read — the job is still kept, just
// untagged, so it stays visible in the feed.
async function readDetail(url, title) {
  const $ = cheerio.load(await getHtml(url));

  let seniority = "";
  let employmentTypeLabel = "";
  $(".description__job-criteria-item").each((_, el) => {
    const label = $(el).find("h3").first().text();
    if (/seniority/i.test(label)) seniority = $(el).find("span").first().text().trim();
    if (/employment\s*type/i.test(label)) {
      employmentTypeLabel = $(el).find("span").first().text().trim();
    }
  });

  const description =
    $(".show-more-less-html__markup").text() || $(".description__text").text();
  const experience = extractExperience(description);

  // LinkedIn's own criteria label is authoritative when present — it's the
  // employer's own selection. Only fall back to scanning the title +
  // description when the posting doesn't carry that criteria item.
  const employmentType =
    normalizeEmploymentType(employmentTypeLabel) ||
    detectEmploymentTypeFromText(`${title || ""} ${description}`);

  return {
    seniority,
    employmentType,
    expMin: experience ? experience.min : null,
    expMax: experience ? experience.max : null,
    expText: experience ? experience.text : "",
  };
}

// Tag listings with experience data. Only jobs we haven't already read are
// fetched, so repeat scrapes cost almost nothing. Also requires employmentType
// to be present (not just expCheckedAt) so jobs read before that field existed
// get one more pass to backfill it, instead of staying untagged forever.
async function enrichExperience(listings) {
  const known = await Job.find(
    {
      url: { $in: listings.map((l) => l.url) },
      expCheckedAt: { $ne: null },
      employmentType: { $exists: true },
    },
    { url: 1 }
  ).lean();
  const alreadyRead = new Set(known.map((j) => j.url));
  const pending = listings
    .filter((l) => !alreadyRead.has(l.url))
    .sort((a, b) => b.postedAt - a.postedAt); // newest first — the top of the feed
  if (pending.length === 0) {
    return { enriched: 0, skipped: listings.length, deferred: 0 };
  }

  const todo = pending.slice(0, MAX_DETAIL_FETCHES);
  const deadline = Date.now() + ENRICH_BUDGET_MS;
  let blocked = 0;
  let ranOut = false;

  await mapLimit(todo, DETAIL_CONCURRENCY, async (listing) => {
    if (blocked >= 5) return; // LinkedIn is throttling hard — stop asking
    if (Date.now() > deadline) {
      ranOut = true;
      return;
    }
    try {
      Object.assign(listing, await readDetail(listing.url, listing.title), {
        expCheckedAt: new Date(),
      });
    } catch (err) {
      if (err instanceof BlockedError) blocked += 1;
    }
  });

  const enriched = todo.filter((l) => l.expCheckedAt).length;
  const deferred = pending.length - enriched;
  if (blocked) {
    console.warn(`[jobs] ${blocked} detail fetches blocked — those jobs stay untagged`);
  }
  if (ranOut) {
    console.log(`[jobs] experience budget spent — ${deferred} jobs deferred to the next run`);
  }
  return { enriched, skipped: listings.length - pending.length, deferred };
}

async function upsertJobs(jobs, keywords, location) {
  if (jobs.length === 0) return 0;
  const ops = jobs.map((j) => {
    const $set = {
      title: j.title,
      company: j.company,
      location: j.location,
      postedAt: j.postedAt,
      postedText: j.postedText,
      keyword: keywords.toLowerCase(),
      searchLocation: (location || "").toLowerCase(),
    };
    // only overwrite experience fields when this run actually read the posting,
    // so a throttled run never wipes tags collected earlier
    if (j.expCheckedAt) {
      Object.assign($set, {
        expMin: j.expMin,
        expMax: j.expMax,
        expText: j.expText,
        seniority: j.seniority,
        employmentType: j.employmentType || "",
        expCheckedAt: j.expCheckedAt,
      });
    }
    return { updateOne: { filter: { url: j.url }, update: { $set }, upsert: true } };
  });
  const result = await Job.bulkWrite(ops, { ordered: false });
  return result.upsertedCount;
}

async function runSearch(search) {
  const startedAt = Date.now();
  throttleHits = 0;

  const listings = await collectListings(search.keywords, search.location);

  // Save the listings before reading any detail pages: the feed can show them
  // immediately while experience tagging — the slow half — carries on behind it.
  const inserted = await upsertJobs(listings, search.keywords, search.location);
  const listedAt = Date.now();

  const { enriched, skipped, deferred } = await enrichExperience(listings);
  const tagged = listings.filter((l) => l.expCheckedAt);
  if (tagged.length > 0) await upsertJobs(tagged, search.keywords, search.location);

  await JobSearch.updateOne({ _id: search._id }, { $set: { lastScrapedAt: new Date() } });

  const secs = (ms) => (ms / 1000).toFixed(1);
  console.log(
    `[jobs] "${search.keywords}" @ "${search.location || "anywhere"}" — ` +
      `${listings.length} listings (${inserted} new) in ${secs(listedAt - startedAt)}s, ` +
      `then ${enriched} read for experience (${skipped} already tagged, ${deferred} deferred) ` +
      `in ${secs(Date.now() - listedAt)}s` +
      (throttleHits ? ` — throttled ${throttleHits}×, gap now ${gapMs}ms` : "")
  );
  return { found: listings.length, inserted, enriched, deferred };
}

// Scrape every tracked search (used by cron).
export async function scrapeAllJobs() {
  if (busy) {
    console.log("[jobs] previous scrape still running, skipping this round");
    return { skipped: true };
  }
  busy = true;

  try {
    const searches = await JobSearch.find().lean();
    if (searches.length === 0) {
      console.log("[jobs] no tracked searches yet — save preferences in the app first");
      return { searches: 0 };
    }

    let found = 0;
    let inserted = 0;
    for (const [i, search] of searches.entries()) {
      try {
        const res = await runSearch(search);
        found += res.found;
        inserted += res.inserted;
      } catch (err) {
        console.warn(`[jobs] search "${search.keywords}" failed: ${err.message}`);
      }
      if (i < searches.length - 1) await sleep(1500); // politeness gap between searches
    }

    return { searches: searches.length, found, inserted };
  } finally {
    busy = false;
  }
}

// Scrape a single search immediately (used when the user saves preferences,
// so the first listings appear without waiting for the next cron run).
export async function scrapeJobsForSearch(keywords, location) {
  if (busy) return { skipped: true };
  busy = true;

  try {
    const search = await JobSearch.findOne({
      keywords: keywords.toLowerCase(),
      location: (location || "").toLowerCase(),
    });
    if (!search) return { searches: 0 };
    return await runSearch(search);
  } finally {
    busy = false;
  }
}
