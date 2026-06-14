import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import multer from "multer";
import ApplyProfile from "../models/ApplyProfile.js";
import Application, { PLATFORMS, STATUSES } from "../models/Application.js";
import { detectPlatform, PLATFORM_CONFIG } from "../apply/platforms.js";
import { prepareApplication, openLogin, checkLogin } from "../apply/prepare.js";
import { isBusy } from "../apply/session.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const router = Router();

// ---- resume upload (multer) ----
const ALLOWED_RESUME = /pdf|msword|officedocument|rtf|text\/plain/;
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 10) || ".pdf";
    cb(null, `resume-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) =>
    ALLOWED_RESUME.test(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Resume must be a PDF, Word, RTF or text file")),
});

// editable profile fields, copied straight from the request body
const PROFILE_FIELDS = [
  "firstName", "lastName", "email", "phone", "city", "country", "headline",
  "currentCompany", "currentTitle", "totalExperienceYears", "currentCtc",
  "expectedCtc", "noticePeriodDays", "workAuthorized", "requiresSponsorship",
  "linkedinUrl", "githubUrl", "portfolioUrl", "coverLetterTemplate",
];

function sanitizeProfile(body) {
  const out = {};
  for (const key of PROFILE_FIELDS) {
    if (!(key in body)) continue;
    const v = body[key];
    if (key === "workAuthorized" || key === "requiresSponsorship") out[key] = !!v;
    else if (key === "totalExperienceYears" || key === "noticePeriodDays")
      out[key] = v === "" || v == null ? null : Number(v);
    else out[key] = String(v ?? "").slice(0, 4000);
  }
  if (Array.isArray(body.extraAnswers)) {
    out.extraAnswers = body.extraAnswers
      .filter((a) => a && a.label)
      .slice(0, 40)
      .map((a) => ({
        label: String(a.label).slice(0, 200),
        value: String(a.value ?? "").slice(0, 1000),
      }));
  }
  return out;
}

// GET /api/apply/profile — the singleton apply profile (created empty if absent)
router.get("/profile", async (_req, res) => {
  try {
    const profile = await ApplyProfile.findOneAndUpdate(
      { singleton: "me" },
      { $setOnInsert: { singleton: "me" } },
      { upsert: true, new: true }
    ).lean();
    res.json({ profile });
  } catch (err) {
    console.error("[api/apply/profile GET]", err.message);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

// PUT /api/apply/profile — save profile fields
router.put("/profile", async (req, res) => {
  try {
    const update = sanitizeProfile(req.body || {});
    const profile = await ApplyProfile.findOneAndUpdate(
      { singleton: "me" },
      { $set: update },
      { upsert: true, new: true }
    ).lean();
    res.json({ ok: true, profile });
  } catch (err) {
    console.error("[api/apply/profile PUT]", err.message);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

// POST /api/apply/resume — upload/replace the resume file
router.post("/resume", (req, res) => {
  upload.single("resume")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      const prev = await ApplyProfile.findOne({ singleton: "me" }).lean();
      const resumeFile = {
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date(),
      };
      await ApplyProfile.findOneAndUpdate(
        { singleton: "me" },
        { $set: { resumeFile } },
        { upsert: true }
      );
      // best-effort cleanup of the previous file
      const old = prev?.resumeFile?.storedName;
      if (old && old !== req.file.filename) {
        fs.promises.unlink(path.join(UPLOADS_DIR, old)).catch(() => {});
      }
      res.json({ ok: true, resumeFile });
    } catch (e) {
      console.error("[api/apply/resume]", e.message);
      res.status(500).json({ error: "Failed to save resume" });
    }
  });
});

// GET /api/apply/resume — stream the stored resume back for preview/download
router.get("/resume", async (_req, res) => {
  try {
    const profile = await ApplyProfile.findOne({ singleton: "me" }).lean();
    const stored = profile?.resumeFile?.storedName;
    if (!stored) return res.status(404).json({ error: "No resume uploaded" });
    const file = path.join(UPLOADS_DIR, stored);
    if (!fs.existsSync(file)) return res.status(404).json({ error: "Resume file missing" });
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${profile.resumeFile.originalName || stored}"`
    );
    res.sendFile(file);
  } catch (err) {
    console.error("[api/apply/resume GET]", err.message);
    res.status(500).json({ error: "Failed to load resume" });
  }
});

// GET /api/apply — the application queue / tracker
router.get("/", async (req, res) => {
  try {
    const query = {};
    if (req.query.status && STATUSES.includes(req.query.status)) query.status = req.query.status;
    if (req.query.platform && PLATFORMS.includes(req.query.platform)) query.platform = req.query.platform;
    const applications = await Application.find(query).sort({ updatedAt: -1 }).limit(500).lean();
    res.json({ count: applications.length, busy: isBusy(), applications });
  } catch (err) {
    console.error("[api/apply GET]", err.message);
    res.status(500).json({ error: "Failed to load applications" });
  }
});

// POST /api/apply/queue { title, company, location, applyUrl, sourceJobUrl?, jobRef? }
router.post("/queue", async (req, res) => {
  try {
    const applyUrl = String(req.body?.applyUrl || "").trim();
    const title = String(req.body?.title || "").trim().slice(0, 300);
    if (!applyUrl || !title) return res.status(400).json({ error: "title and applyUrl are required" });

    const platform = detectPlatform(applyUrl);
    const doc = {
      title,
      company: String(req.body?.company || "").trim().slice(0, 200),
      location: String(req.body?.location || "").trim().slice(0, 200),
      applyUrl,
      sourceJobUrl: String(req.body?.sourceJobUrl || applyUrl).trim(),
      jobRef: req.body?.jobRef || null,
      platform,
    };

    // dedup on applyUrl — re-queueing a job just returns the existing row
    const application = await Application.findOneAndUpdate(
      { applyUrl },
      { $setOnInsert: { ...doc, status: "queued", queuedAt: new Date() } },
      { upsert: true, new: true }
    ).lean();

    res.json({ ok: true, application });
  } catch (err) {
    console.error("[api/apply/queue]", err.message);
    res.status(500).json({ error: "Failed to queue application" });
  }
});

// POST /api/apply/:id/prepare — open + auto-fill in the visible browser
router.post("/:id/prepare", async (req, res) => {
  try {
    const app = await Application.findById(req.params.id).lean();
    if (!app) return res.status(404).json({ error: "Application not found" });
    if (isBusy()) {
      return res.status(409).json({ error: "Another apply action is in progress — try again shortly" });
    }
    // fire-and-forget; the client polls GET /api/apply for the status change
    prepareApplication(app._id).catch((err) =>
      console.warn("[api/apply/prepare]", err.message)
    );
    res.json({ ok: true, message: "Preparing — a browser window will open shortly" });
  } catch (err) {
    console.error("[api/apply/prepare]", err.message);
    res.status(500).json({ error: "Failed to start prepare" });
  }
});

// PATCH /api/apply/:id { status?, note? } — mark submitted/skipped, edit note
router.patch("/:id", async (req, res) => {
  try {
    const update = {};
    if (req.body?.status && STATUSES.includes(req.body.status)) {
      update.status = req.body.status;
      if (req.body.status === "submitted") update.submittedAt = new Date();
    }
    if (typeof req.body?.note === "string") update.note = req.body.note.slice(0, 2000);
    if (Object.keys(update).length === 0) return res.status(400).json({ error: "Nothing to update" });

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    ).lean();
    if (!application) return res.status(404).json({ error: "Application not found" });
    res.json({ ok: true, application });
  } catch (err) {
    console.error("[api/apply PATCH]", err.message);
    res.status(500).json({ error: "Failed to update application" });
  }
});

// DELETE /api/apply/:id — drop from the queue
router.delete("/:id", async (req, res) => {
  try {
    await Application.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("[api/apply DELETE]", err.message);
    res.status(500).json({ error: "Failed to delete application" });
  }
});

// GET /api/apply/platforms — config + (best-effort) login status for the UI
router.get("/platforms", async (_req, res) => {
  const platforms = Object.values(PLATFORM_CONFIG).map((c) => ({
    id: c.id,
    label: c.label,
    tuned: c.tuned,
    loginUrl: c.loginUrl,
  }));
  res.json({ platforms, busy: isBusy() });
});

// POST /api/apply/platforms/:platform/login — open the login page in a window
router.post("/platforms/:platform/login", async (req, res) => {
  try {
    if (isBusy()) return res.status(409).json({ error: "Another apply action is in progress" });
    // fire-and-forget: the window opens; the user signs in there
    openLogin(req.params.platform).catch((err) => console.warn("[api/apply/login]", err.message));
    res.json({ ok: true, message: "A browser window is opening — sign in there" });
  } catch (err) {
    console.error("[api/apply/login]", err.message);
    res.status(500).json({ error: "Failed to open login" });
  }
});

// GET /api/apply/platforms/:platform/login — re-check a session's login state
router.get("/platforms/:platform/login", async (req, res) => {
  try {
    if (isBusy()) return res.status(409).json({ error: "Busy" });
    const result = await checkLogin(req.params.platform);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
