// Job-application email automation — ported from the standalone
// job-automation project (Next.js + SQLite) into this server's Express +
// better-sqlite3, single-user (no login, see server/automation/db.js).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import multer from "multer";
import { getDb, getSetting, setSetting, log } from "../automation/db.js";
import { deleteSmtpCreds, getSmtpCredsView, saveSmtpCreds } from "../automation/smtp.js";
import { resetTransporter, verifyConnection, renderTemplate, sendMail } from "../automation/mailer.js";
import { parseSheet } from "../automation/excel.js";
import { startAutomation, automationStatus, stopAutomation } from "../automation/engine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const router = Router();

// ---- resume upload (multer, disk) — one fixed file, same pattern as /api/apply/resume ----
const resumeStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 10) || ".pdf";
    cb(null, `automation-resume${ext}`);
  },
});
const ALLOWED_RESUME = /pdf|msword|officedocument|rtf|text\/plain/;
const uploadResume = multer({
  storage: resumeStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    ALLOWED_RESUME.test(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Resume must be a PDF, Word, RTF or text file")),
});

// ---- excel upload (multer, memory — parsed and discarded, nothing persisted) ----
const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ---- SMTP credentials ----

router.get("/smtp", (_req, res) => {
  res.json({ ok: true, creds: getSmtpCredsView() });
});

router.post("/smtp", async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.host || !body.smtpUser || !body.smtpPass) {
      return res.status(400).json({ ok: false, error: "host, smtpUser, smtpPass required" });
    }
    saveSmtpCreds({
      host: body.host,
      port: Number(body.port || 587),
      secure: Boolean(body.secure),
      smtpUser: body.smtpUser,
      smtpPass: body.smtpPass,
      senderName: body.senderName?.trim() || undefined,
      senderEmail: body.senderEmail?.trim() || body.smtpUser,
      replyTo: body.replyTo?.trim() || undefined,
    });
    resetTransporter();
    log("info", "SMTP credentials updated");

    let verified;
    if (body.verify) verified = await verifyConnection();

    res.json({ ok: true, verified });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

router.delete("/smtp", (_req, res) => {
  deleteSmtpCreds();
  resetTransporter();
  res.json({ ok: true });
});

router.post("/smtp/test", async (_req, res) => {
  const v = await verifyConnection();
  res.json(v);
});

// ---- stats ----

router.get("/stats", (_req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT status, COUNT(*) as count FROM recipients GROUP BY status").all();

  const stats = { total: 0, pending: 0, sending: 0, sent: 0, failed: 0, skipped: 0 };
  for (const r of rows) {
    stats[r.status] = r.count;
    stats.total += r.count;
  }

  const lastSent = db
    .prepare("SELECT email, sent_at FROM recipients WHERE status='sent' ORDER BY sent_at DESC LIMIT 1")
    .get();

  res.json({ ok: true, stats, lastSent: lastSent ?? null });
});

// ---- template ----

router.get("/template", (_req, res) => {
  res.json({ ok: true, subject: getSetting("subject"), body: getSetting("body") });
});

router.post("/template", (req, res) => {
  const { subject, body } = req.body || {};
  if (typeof subject === "string") setSetting("subject", subject);
  if (typeof body === "string") setSetting("body", body);
  res.json({ ok: true });
});

// ---- test email ----

router.post("/test-email", async (req, res) => {
  try {
    const { to } = req.body || {};
    if (!to) return res.status(400).json({ ok: false, error: "to required" });
    const vars = { email: to, name: "Test", company: "Test Co", role: "Test Role" };
    const subject = renderTemplate(getSetting("subject"), vars);
    const body = renderTemplate(getSetting("body"), vars);
    const resumePath = getSetting("resume_path");
    await sendMail({ to, subject, text: body, resumePath: resumePath || undefined });
    log("info", `Test email sent to ${to}`);
    res.json({ ok: true });
  } catch (e) {
    log("error", `Test email failed: ${e.message}`);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- recipients ----

router.get("/recipients", (req, res) => {
  const { status, q } = req.query;
  const limit = Math.min(Number(req.query.limit) || 500, 2000);

  const where = [];
  const params = [];
  if (status && status !== "all") {
    where.push("status = ?");
    params.push(status);
  }
  if (q) {
    where.push("(email LIKE ? OR name LIKE ? OR company LIKE ? OR role LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const sql = `SELECT * FROM recipients ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT ?`;
  params.push(limit);
  const rows = getDb().prepare(sql).all(...params);
  res.json({ ok: true, recipients: rows });
});

router.delete("/recipients", (req, res) => {
  const { id, all } = req.query;
  const db = getDb();
  if (all === "true") {
    db.prepare("DELETE FROM recipients").run();
    return res.json({ ok: true, deleted: "all" });
  }
  if (!id) return res.status(400).json({ ok: false, error: "id or all=true required" });
  db.prepare("DELETE FROM recipients WHERE id = ?").run(Number(id));
  res.json({ ok: true });
});

router.patch("/recipients", (req, res) => {
  const { id, action } = req.body || {};
  if (!id || !action) return res.status(400).json({ ok: false, error: "id and action required" });
  const db = getDb();
  if (action === "reset") {
    db.prepare(
      "UPDATE recipients SET status='pending', attempts=0, error=NULL, sent_at=NULL WHERE id = ?"
    ).run(id);
    return res.json({ ok: true });
  }
  if (action === "skip") {
    db.prepare("UPDATE recipients SET status='skipped' WHERE id = ?").run(id);
    return res.json({ ok: true });
  }
  res.status(400).json({ ok: false, error: "unknown action" });
});

// ---- uploads ----

router.post("/upload/excel", (req, res) => {
  uploadExcel.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, error: err.message });
    if (!req.file) return res.status(400).json({ ok: false, error: "No file uploaded" });

    try {
      const mode = String(req.body?.mode || "append");
      const rows = parseSheet(req.file.buffer);

      if (rows.length === 0) {
        return res.status(400).json({
          ok: false,
          error: 'No valid emails found. Make sure the sheet has an "email" column.',
        });
      }

      const db = getDb();
      if (mode === "replace") {
        db.prepare("DELETE FROM recipients WHERE status IN ('pending','failed')").run();
      }

      const insert = db.prepare(
        `INSERT INTO recipients (email, name, company, role)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           name = COALESCE(excluded.name, recipients.name),
           company = COALESCE(excluded.company, recipients.company),
           role = COALESCE(excluded.role, recipients.role)`
      );

      let inserted = 0;
      const tx = db.transaction((items) => {
        for (const r of items) {
          const info = insert.run(r.email, r.name ?? null, r.company ?? null, r.role ?? null);
          if (info.changes > 0) inserted += 1;
        }
      });
      tx(rows);

      log("info", `Excel upload: parsed=${rows.length}, mode=${mode}`);
      res.json({ ok: true, parsed: rows.length, inserted });
    } catch (e) {
      log("error", `Excel upload failed: ${e.message}`);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
});

router.post("/upload/resume", (req, res) => {
  uploadResume.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, error: err.message });
    if (!req.file) return res.status(400).json({ ok: false, error: "No file uploaded" });
    try {
      setSetting("resume_path", req.file.path);
      setSetting("resume_original_name", req.file.originalname);
      log("info", `Resume uploaded: ${req.file.originalname} (${req.file.size} bytes)`);
      res.json({ ok: true, path: req.file.path, name: req.file.originalname, size: req.file.size });
    } catch (e) {
      log("error", `Resume upload failed: ${e.message}`);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
});

router.get("/upload/resume", (_req, res) => {
  const p = getSetting("resume_path");
  if (!p || !fs.existsSync(p)) return res.json({ ok: true, exists: false });
  const stat = fs.statSync(p);
  res.json({
    ok: true,
    exists: true,
    name: getSetting("resume_original_name") || path.basename(p),
    size: stat.size,
    uploadedAt: stat.mtime.toISOString(),
  });
});

// ---- automation control ----

router.post("/start", async (_req, res) => {
  const result = await startAutomation();
  res.status(result.ok ? 200 : 400).json(result);
});

router.get("/status", (_req, res) => {
  res.json({ ok: true, ...automationStatus() });
});

router.post("/stop", (_req, res) => {
  res.json(stopAutomation());
});

export default router;
