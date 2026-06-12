import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import newsRoutes from "./routes/news.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";
import weatherRoutes from "./routes/weather.routes.js";
import { startScheduler } from "./cron/scheduler.js";

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/daily-pulse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
  });
});

app.use("/api/news", newsRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/weather", weatherRoutes);

// If the client has been built, serve it from the same process so a single
// free-tier service can host the whole app.
const clientDist = path.resolve(__dirname, "../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("[db] connected to MongoDB");
  } catch (err) {
    console.error("[db] connection failed:", err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`[server] Daily Pulse API running on http://localhost:${PORT}`);
  });

  startScheduler();
}

start();
