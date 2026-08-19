// Single-row SMTP credential storage — ported from job-automation's
// lib/smtp.ts, dropped from per-user (keyed by user_id) to the one row this
// single-user server ever needs (id fixed at 1).
import { getDb } from "./db.js";
import { encrypt, decrypt } from "./crypto.js";

export function saveSmtpCreds(c) {
  if (!c.host || !c.port || !c.smtpUser || !c.smtpPass) {
    throw new Error("host, port, smtpUser and smtpPass are required");
  }
  const enc = encrypt(c.smtpPass);
  getDb()
    .prepare(
      `INSERT INTO smtp_credentials
         (id, host, port, secure, smtp_user, smtp_pass_enc, sender_name, sender_email, reply_to, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         host = excluded.host,
         port = excluded.port,
         secure = excluded.secure,
         smtp_user = excluded.smtp_user,
         smtp_pass_enc = excluded.smtp_pass_enc,
         sender_name = excluded.sender_name,
         sender_email = excluded.sender_email,
         reply_to = excluded.reply_to,
         updated_at = datetime('now')`
    )
    .run(
      c.host,
      c.port,
      c.secure ? 1 : 0,
      c.smtpUser,
      enc,
      c.senderName ?? null,
      c.senderEmail ?? null,
      c.replyTo ?? null
    );
}

function row() {
  return getDb().prepare("SELECT * FROM smtp_credentials WHERE id = 1").get();
}

export function getSmtpCreds() {
  const r = row();
  if (!r) return null;
  return {
    host: r.host,
    port: r.port,
    secure: r.secure === 1,
    smtpUser: r.smtp_user,
    smtpPass: decrypt(r.smtp_pass_enc),
    senderName: r.sender_name,
    senderEmail: r.sender_email,
    replyTo: r.reply_to,
  };
}

export function getSmtpCredsView() {
  const r = row();
  if (!r) return null;
  return {
    host: r.host,
    port: r.port,
    secure: r.secure === 1,
    smtpUser: r.smtp_user,
    senderName: r.sender_name,
    senderEmail: r.sender_email,
    replyTo: r.reply_to,
    updatedAt: r.updated_at,
  };
}

export function deleteSmtpCreds() {
  getDb().prepare("DELETE FROM smtp_credentials WHERE id = 1").run();
}
