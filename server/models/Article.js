import mongoose from "mongoose";

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, unique: true },
    source: { type: String, required: true },
    category: {
      type: String,
      enum: ["tech", "business", "sports", "world"],
      required: true,
    },
    publishedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

articleSchema.index({ category: 1, publishedAt: -1 });
articleSchema.index({ publishedAt: -1 });

// The app never shows news older than "this week", so auto-purge documents
// 30 days after they're scraped. This keeps storage flat on a free-tier
// cluster (Atlas M0 = 512 MB) — MongoDB's TTL reaper deletes them for us.
articleSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default mongoose.model("Article", articleSchema);
