import { Router } from "express";
import Job from "../models/Job.js";
import JobSearch from "../models/JobSearch.js";
import { scrapeJobsForSearch } from "../scrapers/jobs.scraper.js";
import { experienceQuery } from "../scrapers/experience.js";
import { timeRangeCutoff } from "../utils/time.js";

const router = Router();

// clamp a years-of-experience bound; blank/garbage means "no bound"
function expBound(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 0), 40) : null;
}

// GET /api/jobs?keyword=react%20developer&location=remote&timeRange=3d&expMin=0&expMax=3
router.get("/", async (req, res) => {
  try {
    const { keyword, location, timeRange } = req.query;
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const query = {};
    if (keyword) query.keyword = String(keyword).trim().toLowerCase();
    if (location) query.searchLocation = String(location).trim().toLowerCase();

    const cutoff = timeRangeCutoff(timeRange);
    if (cutoff) query.postedAt = { $gte: cutoff };

    // Jobs whose stated requirement overlaps the requested band, plus every job
    // that never stated one — a vague posting is never hidden.
    const expFilter = experienceQuery(expBound(req.query.expMin), expBound(req.query.expMax));
    if (expFilter) Object.assign(query, expFilter);

    const jobs = await Job.find(query)
      .sort({ postedAt: -1 })
      .limit(limit)
      .select(
        "title company location url postedAt postedText keyword expMin expMax expText seniority"
      )
      .lean();

    res.json({ count: jobs.length, jobs });
  } catch (err) {
    console.error("[api/jobs]", err.message);
    res.status(500).json({ error: "Failed to load jobs" });
  }
});

// POST /api/jobs/preferences { keywords, location }
// Syncs the user's localStorage job preferences to the server so the cron
// scraper knows what to search, and kicks off an immediate first scrape.
router.post("/preferences", async (req, res) => {
  try {
    const keywords = String(req.body?.keywords || "").trim().slice(0, 100);
    const location = String(req.body?.location || "").trim().slice(0, 100);

    if (!keywords) {
      return res.status(400).json({ error: "keywords is required" });
    }

    // v1 is single-user: the latest saved preference replaces older searches
    // so cron only scrapes what the dashboard actually shows.
    await JobSearch.deleteMany({});
    await JobSearch.create({ keywords, location });

    // fire-and-forget so the response is instant; the client polls GET /api/jobs
    scrapeJobsForSearch(keywords, location).catch((err) =>
      console.warn("[api/jobs] initial scrape failed:", err.message)
    );

    res.json({ ok: true, message: "Preferences saved — first scrape is running" });
  } catch (err) {
    console.error("[api/jobs/preferences]", err.message);
    res.status(500).json({ error: "Failed to save preferences" });
  }
});

export default router;
