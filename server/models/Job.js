import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    location: { type: String, default: "", trim: true },
    url: { type: String, required: true, unique: true },
    postedAt: { type: Date, required: true },
    postedText: { type: String, default: "" },
    // the search that surfaced this job, so the API can filter per user preference
    keyword: { type: String, required: true, lowercase: true, trim: true },
    searchLocation: { type: String, default: "", lowercase: true, trim: true },

    // Experience required, parsed from the posting's own description.
    // null means the posting never said — such jobs are always shown rather
    // than treated as zero. expMax null on a tagged job means open-ended ("5+").
    expMin: { type: Number, default: null },
    expMax: { type: Number, default: null },
    expText: { type: String, default: "" }, // the phrase we matched, for display
    seniority: { type: String, default: "" }, // LinkedIn's own label, informational
    expCheckedAt: { type: Date, default: null }, // set once the detail page was read
  },
  { timestamps: true }
);

jobSchema.index({ keyword: 1, postedAt: -1 });

// Auto-purge listings 30 days after scraping — postings go stale fast and the
// app only ever filters up to "this week". Keeps the free-tier cluster small.
jobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default mongoose.model("Job", jobSchema);
