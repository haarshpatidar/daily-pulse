import mongoose from "mongoose";

// Tracks which job searches the cron scraper should run. The client syncs
// the user's localStorage preferences here via POST /api/jobs/preferences.
const jobSearchSchema = new mongoose.Schema(
  {
    keywords: { type: String, required: true, trim: true, lowercase: true },
    location: { type: String, default: "", trim: true, lowercase: true },
    lastScrapedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

jobSearchSchema.index({ keywords: 1, location: 1 }, { unique: true });

export default mongoose.model("JobSearch", jobSearchSchema);
