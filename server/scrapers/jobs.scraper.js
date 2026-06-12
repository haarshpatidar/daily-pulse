import puppeteer from "puppeteer";
import Job from "../models/Job.js";
import JobSearch from "../models/JobSearch.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const LAUNCH_OPTIONS = {
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--window-size=1366,768",
  ],
};

// LinkedIn's logged-out "see more jobs" endpoint returns a chunk of job cards
// at a given offset. Walking it with start += (cards returned) collects every
// public listing, not just the first page.
const GUEST_SEARCH_API =
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";

const PAGE_DELAY_MS = 1300; // politeness gap between pagination requests
const MAX_JOBS = 600; // safety ceiling per search
const MAX_PAGES = 80; // hard stop in case the offset never empties
const STALE_LIMIT = 3; // stop after N pages that add nothing new

// Only one Puppeteer run at a time — cron and the on-demand trigger share this.
let busy = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildGuestUrl(keywords, location, start) {
  const params = new URLSearchParams({
    keywords,
    location: location || "",
    f_TPR: "r604800", // posted within the last week — widest filter the app offers
    start: String(start),
  });
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

async function preparePage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1366, height: 768 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
  return page;
}

// Scrape every public listing for one search by paginating LinkedIn's guest
// endpoint. Returns normalized, de-duplicated job objects.
// Throws only if the very first page is blocked (auth wall / throttle); a block
// part-way through keeps whatever was already collected.
export async function extractJobs(page, keywords, location) {
  const byUrl = new Map();
  let start = 0;
  let empties = 0;
  let stale = 0;
  let pages = 0;

  while (start < MAX_JOBS && pages < MAX_PAGES && empties < 2 && stale < STALE_LIMIT) {
    const resp = await page.goto(buildGuestUrl(keywords, location, start), {
      waitUntil: "domcontentloaded",
      timeout: 40000,
    });
    pages += 1;

    const status = resp ? resp.status() : 0;
    if (status === 429 || status === 403) {
      if (byUrl.size === 0) throw new Error(`LinkedIn returned HTTP ${status}`);
      console.warn(`[jobs] throttled (HTTP ${status}) after ${byUrl.size} jobs — stopping early`);
      break;
    }
    if (/authwall|\/login|\/checkpoint/.test(page.url())) {
      if (byUrl.size === 0) throw new Error("LinkedIn served an auth wall");
      break;
    }

    const raw = await page.$$eval("li", (cards) =>
      cards.map((card) => {
        const text = (sel) => card.querySelector(sel)?.textContent?.trim() || "";
        const timeEl = card.querySelector("time");
        const link =
          card.querySelector("a.base-card__full-link") || card.querySelector("a");
        return {
          title: text("h3.base-search-card__title"),
          company: text("h4.base-search-card__subtitle"),
          location: text("span.job-search-card__location"),
          postedText: timeEl?.textContent?.trim() || "",
          postedISO: timeEl?.getAttribute("datetime") || "",
          url: link?.href || "",
        };
      })
    );

    const valid = raw.filter((j) => j.title && j.url);
    if (valid.length === 0) {
      empties += 1;
      start += 10; // nudge past a possible gap before giving up
      continue;
    }
    empties = 0;

    const before = byUrl.size;
    for (const j of valid) {
      // strip tracking params so the same posting always dedupes to one URL
      const url = j.url.split("?")[0];
      if (byUrl.has(url)) continue;
      byUrl.set(url, {
        title: j.title,
        company: j.company || "Unknown",
        location: j.location,
        url,
        postedAt: parsePostedDate(j.postedISO, j.postedText),
        postedText: j.postedText,
      });
    }

    stale = byUrl.size === before ? stale + 1 : 0;
    start += valid.length;
    await sleep(PAGE_DELAY_MS);
  }

  return [...byUrl.values()];
}

async function upsertJobs(jobs, keywords, location) {
  if (jobs.length === 0) return 0;
  const ops = jobs.map((j) => ({
    updateOne: {
      filter: { url: j.url },
      update: {
        $set: {
          title: j.title,
          company: j.company,
          location: j.location,
          postedAt: j.postedAt,
          postedText: j.postedText,
          keyword: keywords.toLowerCase(),
          searchLocation: (location || "").toLowerCase(),
        },
      },
      upsert: true,
    },
  }));
  const result = await Job.bulkWrite(ops, { ordered: false });
  return result.upsertedCount;
}

async function runSearch(browser, search) {
  const page = await preparePage(browser);
  try {
    const jobs = await extractJobs(page, search.keywords, search.location);
    const inserted = await upsertJobs(jobs, search.keywords, search.location);
    await JobSearch.updateOne({ _id: search._id }, { $set: { lastScrapedAt: new Date() } });
    console.log(
      `[jobs] "${search.keywords}" @ "${search.location || "anywhere"}" — ${jobs.length} listings, ${inserted} new`
    );
    return { found: jobs.length, inserted };
  } finally {
    await page.close();
  }
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

    const browser = await puppeteer.launch(LAUNCH_OPTIONS);
    let found = 0;
    let inserted = 0;
    try {
      for (const [i, search] of searches.entries()) {
        try {
          const res = await runSearch(browser, search);
          found += res.found;
          inserted += res.inserted;
        } catch (err) {
          console.warn(`[jobs] search "${search.keywords}" failed: ${err.message}`);
        }
        if (i < searches.length - 1) await sleep(4000); // politeness gap between searches
      }
    } finally {
      await browser.close();
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

    const browser = await puppeteer.launch(LAUNCH_OPTIONS);
    try {
      return await runSearch(browser, search);
    } finally {
      await browser.close();
    }
  } finally {
    busy = false;
  }
}
