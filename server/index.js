import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import newsRoutes from "./routes/news.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";
import companiesRoutes from "./routes/companies.routes.js";
import weatherRoutes from "./routes/weather.routes.js";
// --- Assisted apply: DISABLED 2026-08-16 ---
// Left in the tree but unwired. It needs a headful Chrome, a persistent
// userDataDir and disk writes, none of which work on a normal Node host.
// Keeping this import out also means models/Application.js and
// models/ApplyProfile.js are never imported, so mongoose never registers
// those collections and the DB stays untouched by this feature.
// import applyRoutes from "./routes/apply.routes.js";
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
app.use("/api/companies", companiesRoutes);
app.use("/api/weather", weatherRoutes);
// app.use("/api/apply", applyRoutes); // disabled — see note above

// Serve auto-fill screenshots (apply review previews). Only the screenshots
// subdir is public; resume bytes are served through the authenticated-ish
// /api/apply/resume route instead of by guessable filename.
// Disabled with the apply feature — nothing writes to uploads/ anymore, and a
// hosted container's filesystem is ephemeral anyway.
// app.use(
//   "/uploads/screenshots",
//   express.static(path.join(__dirname, "uploads", "screenshots"))
// );

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
