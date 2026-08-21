import mongoose from "mongoose";

// Tracks what the company-lead scraper should enrich. Like JobSearch this is
// single-user (v1): the latest saved search replaces the previous one, so cron
// only re-enriches the leads the dashboard actually shows.
const companySearchSchema = new mongoose.Schema(
  {
    // explicit company names the user typed in (one lead each)
    companies: { type: [String], default: [] },
    // also pull distinct company names from the scraped Jobs (i.e. companies
    // we already know are hiring)
    fromJobs: { type: Boolean, default: true },
    // a label for this batch, stored on every Company it produces
    keyword: { type: String, default: "", lowercase: true, trim: true },
    lastScrapedAt: { type: Date, default: null },
    // rotating offset into the full deduped company-name list, so a name
    // pool bigger than one run's cap gets covered across successive runs
    // instead of the same leading slice being enriched forever.
    cursor: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("CompanySearch", companySearchSchema);
