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
  },
  { timestamps: true }
);

jobSchema.index({ keyword: 1, postedAt: -1 });

// Auto-purge listings 30 days after scraping — postings go stale fast and the
// app only ever filters up to "this week". Keeps the free-tier cluster small.
jobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default mongoose.model("Job", jobSchema);
