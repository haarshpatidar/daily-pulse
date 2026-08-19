// Send loop with start/stop + throttling — ported from job-automation's
// lib/automation.ts, single global run state instead of one per user.
import { getDb, getSetting, setSetting, log } from "./db.js";
import { renderTemplate, sendMail } from "./mailer.js";
import { getSmtpCreds } from "./smtp.js";

const INTERVAL_MS = Number(process.env.SEND_INTERVAL_MS || 8000);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 2);
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT || 400);

const state = {
  running: false,
  abort: false,
  sentThisRun: 0,
  startedAt: null,
  currentEmail: null,
};

export function automationStatus() {
  return {
    running: state.running,
    sentThisRun: state.sentThisRun,
    startedAt: state.startedAt,
    currentEmail: state.currentEmail,
    persistedStatus: getSetting("automation_status"),
  };
}

export function stopAutomation() {
  if (!state.running) return { ok: true, message: "Not running" };
  state.abort = true;
  log("info", "Stop requested by user");
  return { ok: true, message: "Stop signal sent" };
}

function sleep(ms, checkAbort) {
  return new Promise((resolve) => {
    const step = 250;
    let elapsed = 0;
    const id = setInterval(() => {
      elapsed += step;
      if (checkAbort() || elapsed >= ms) {
        clearInterval(id);
        resolve();
      }
    }, step);
  });
}

export async function startAutomation() {
  if (state.running) return { ok: false, message: "Automation already running" };

  if (!getSmtpCreds()) {
    return { ok: false, message: "Add your SMTP credentials in Email Settings before starting" };
  }

  const resumePath = getSetting("resume_path");
  if (!resumePath) {
    return { ok: false, message: "Upload a resume before starting automation" };
  }

  const pending = getDb()
    .prepare(
      `SELECT * FROM recipients
       WHERE status IN ('pending','failed') AND attempts < ?
       ORDER BY id ASC`
    )
    .all(MAX_RETRIES + 1);

  if (pending.length === 0) {
    return { ok: false, message: "No pending recipients to send to" };
  }

  state.running = true;
  state.abort = false;
  state.sentThisRun = 0;
  state.startedAt = new Date().toISOString();
  setSetting("automation_status", "running");
  log("info", `Automation started — ${pending.length} pending recipients`);

  void runLoop(pending);

  return { ok: true, message: `Started — ${pending.length} pending` };
}

async function runLoop(initial) {
  const db = getDb();
  const subjectTpl = getSetting("subject");
  const bodyTpl = getSetting("body");
  const resumePath = getSetting("resume_path");

  try {
    for (const r of initial) {
      if (state.abort) {
        log("warn", "Automation aborted by user");
        break;
      }
      if (state.sentThisRun >= DAILY_LIMIT) {
        log("warn", `Daily limit ${DAILY_LIMIT} reached — stopping`);
        break;
      }

      state.currentEmail = r.email;
      db.prepare("UPDATE recipients SET status='sending', attempts = attempts + 1 WHERE id = ?").run(
        r.id
      );

      const subject = renderTemplate(subjectTpl, r);
      const body = renderTemplate(bodyTpl, r);

      try {
        await sendMail({ to: r.email, subject, text: body, resumePath });
        db.prepare(
          "UPDATE recipients SET status='sent', sent_at=datetime('now'), error=NULL WHERE id = ?"
        ).run(r.id);
        state.sentThisRun += 1;
        log("info", `Sent -> ${r.email}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        db.prepare("UPDATE recipients SET status='failed', error=? WHERE id = ?").run(msg, r.id);
        log("error", `Failed -> ${r.email}: ${msg}`);
      }

      state.currentEmail = null;
      if (state.abort) break;
      await sleep(INTERVAL_MS, () => state.abort);
    }
  } finally {
    state.running = false;
    state.abort = false;
    state.currentEmail = null;
    setSetting("automation_status", "idle");
    log("info", `Automation finished — ${state.sentThisRun} sent this run`);
  }
}
