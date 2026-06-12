import { Router } from "express";
import Article from "../models/Article.js";
import { timeRangeCutoff } from "../utils/time.js";

const router = Router();

const VALID_CATEGORIES = new Set(["tech", "business", "sports", "world"]);

// GET /api/news?category=tech,world&timeRange=24h&limit=60
router.get("/", async (req, res) => {
  try {
    const { category, timeRange } = req.query;
    const limit = Math.min(Number(req.query.limit) || 60, 120);

    const query = {};

    if (category && category !== "all") {
      const categories = String(category)
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter((c) => VALID_CATEGORIES.has(c));
      if (categories.length > 0) query.category = { $in: categories };
    }

    const cutoff = timeRangeCutoff(timeRange);
    if (cutoff) query.publishedAt = { $gte: cutoff };

    const articles = await Article.find(query)
      .sort({ publishedAt: -1 })
      .limit(limit)
      .select("title url source category publishedAt")
      .lean();

    res.json({ count: articles.length, articles });
  } catch (err) {
    console.error("[api/news]", err.message);
    res.status(500).json({ error: "Failed to load news" });
  }
});

export default router;
