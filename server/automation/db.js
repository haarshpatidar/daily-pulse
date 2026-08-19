// SQLite store for the automation feature — ported from the standalone
// job-automation project (better-sqlite3), collapsed to single-user: no
// users/sessions tables, no user_id columns. Daily Pulse itself always runs
// as one user, same as JobSearch/CompanySearch elsewhere in this server.
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.AUTOMATION_DATA_DIR || path.join(__dirname, "../data");
const DB_PATH = path.join(DATA_DIR, "automation.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

export const DEFAULT_SUBJECT =
  "Application for Software Engineer | React, Next.js, TypeScript Position at {{company}}";

export const DEFAULT_BODY = `Hi {{name}},

I hope you're doing well.

I'm writing to apply for the Software Engineer role at {{company}}. I'm currently a Frontend Developer building production-grade web applications with Next.js, React.js, and TypeScript.

I'd welcome the opportunity to discuss how my experience aligns with your team's needs. My resume is attached.

Thank you for your time.

Best regards,
Your Name`;

let db;

function migrate() {
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS smtp_credentials (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      secure INTEGER NOT NULL DEFAULT 0,
      smtp_user TEXT NOT NULL,
      smtp_pass_enc TEXT NOT NULL,
      sender_name TEXT,
      sender_email TEXT,
      reply_to TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      company TEXT,
      role TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_recipients_status ON recipients(status);
  `);

  const defaults = {
    subject: DEFAULT_SUBJECT,
    body: DEFAULT_BODY,
    automation_status: "idle",
    resume_path: "",
    resume_original_name: "",
  };
  const seed = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(defaults)) seed.run(k, v);
}

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    migrate();
  }
  return db;
}

export function getSetting(key) {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row?.value ?? "";
}

export function setSetting(key, value) {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value);
}

export function log(level, message) {
  try {
    getDb().prepare("INSERT INTO logs (level, message) VALUES (?, ?)").run(level, message);
  } catch {
    /* logging must never break the caller */
  }
  console[level === "error" ? "error" : "log"](`[automation:${level}] ${message}`);
}
