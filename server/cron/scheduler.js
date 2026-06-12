import cron from "node-cron";
import { scrapeNews } from "../scrapers/news.scraper.js";
import { scrapeAllJobs } from "../scrapers/jobs.scraper.js";

let newsRunning = false;

async function runNews() {
  if (newsRunning) {
    console.log("[cron] news scrape still running, skipping");
    return;
  }
  newsRunning = true;
  try {
    await scrapeNews();
  } catch (err) {
    console.error("[cron] news scrape crashed:", err.message);
  } finally {
    newsRunning = false;
  }
}

async function runJobs() {
  try {
    await scrapeAllJobs(); // has its own overlap guard
  } catch (err) {
    console.error("[cron] jobs scrape crashed:", err.message);
  }
}

export function startScheduler() {
  cron.schedule("*/30 * * * *", runNews); // news every 30 minutes
  cron.schedule("0 */3 * * *", runJobs); // jobs every 3 hours

  console.log("[cron] scheduler started — news */30m, jobs every 3h");

  // initial fill so the app has data right after boot (don't block startup)
  runNews();
  runJobs();
}
