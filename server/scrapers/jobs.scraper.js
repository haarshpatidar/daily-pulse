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

// Only one Puppeteer run at a time — cron and the on-demand trigger share this.
let busy = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildSearchUrl(keywords, location) {
  const params = new URLSearchParams({
    keywords,
    location,
    f_TPR: "r604800", // posted within the last week, matching the app's widest time filter
    position: "1",
    pageNum: "0",
  });
  return `https://www.linkedin.com/jobs/search?${params.toString()}`;
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

// Scrape one search from LinkedIn's public (logged-out) jobs page.
// Returns normalized job objects; throws on auth wall / bot challenge.
export async function extractJobs(page, keywords, location) {
  await page.goto(buildSearchUrl(keywords, location), {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  if (/authwall|\/login|\/checkpoint/.test(page.url())) {
    throw new Error("LinkedIn served an auth wall");
  }

  try {
    await page.waitForSelector("ul.jobs-search__results-list li", { timeout: 15000 });
  } catch {
    const noResults = await page.$(".core-section-container__main-title, .no-results");
    if (noResults) return [];
    throw new Error("job results never rendered (possible bot challenge)");
  }

  // nudge lazy-loaded cards into the DOM
  await page.evaluate(() => window.scrollBy(0, 1500));
  await sleep(1500);

  const raw = await page.$$eval("ul.jobs-search__results-list > li", (cards) =>
    cards.map((card) => {
      const text = (sel) => card.querySelector(sel)?.textContent?.trim() || "";
      const timeEl = card.querySelector("time");
      return {
        title: text("h3.base-search-card__title"),
        company: text("h4.base-search-card__subtitle"),
        location: text("span.job-search-card__location"),
        postedText: timeEl?.textContent?.trim() || "",
        postedISO: timeEl?.getAttribute("datetime") || "",
        url: card.querySelector("a.base-card__full-link")?.href || "",
      };
    })
  );

  return raw
    .filter((j) => j.title && j.url)
    .map((j) => ({
      title: j.title,
      company: j.company || "Unknown",
      location: j.location,
      // strip tracking params so the same posting always dedupes to one URL
      url: j.url.split("?")[0],
      postedAt: parsePostedDate(j.postedISO, j.postedText),
      postedText: j.postedText,
    }));
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
