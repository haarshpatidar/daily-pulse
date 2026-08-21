// nodemailer transport + template renderer — ported from job-automation's
// lib/mailer.ts, single transporter instead of one per user.
import nodemailer from "nodemailer";
import fs from "node:fs";
import { getSmtpCreds } from "./smtp.js";

let cached = null;

export function resetTransporter() {
  cached = null;
}

function buildTransporter(creds) {
  return nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    auth: { user: creds.smtpUser, pass: creds.smtpPass },
  });
}

export function getTransporter() {
  const creds = getSmtpCreds();
  if (!creds) {
    throw new Error(
      "SMTP credentials not configured. Open Email Settings and add your email + app password."
    );
  }
  if (cached) return { transporter: cached, creds };
  const transporter = buildTransporter(creds);
  cached = transporter;
  return { transporter, creds };
}

export function renderTemplate(template, vars) {
  return template
    .replace(/\{\{\s*name\s*\}\}/gi, vars.name?.trim() || "there")
    .replace(/\{\{\s*company\s*\}\}/gi, vars.company?.trim() || "your company")
    .replace(/\{\{\s*role\s*\}\}/gi, vars.role?.trim() || "the open role")
    .replace(/\{\{\s*email\s*\}\}/gi, vars.email);
}

export async function sendMail({ to, subject, text, resumePath }) {
  const { transporter, creds } = getTransporter();
  const fromEmail = creds.senderEmail || creds.smtpUser;
  const fromName = creds.senderName || fromEmail;
  const replyTo = creds.replyTo || fromEmail;

  const attachments = [];
  if (resumePath && fs.existsSync(resumePath)) {
    attachments.push({ filename: "resume.pdf", path: resumePath });
  }

  const html = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    replyTo,
    to,
    subject,
    text,
    html,
    attachments,
  });
}

export async function verifyConnection() {
  try {
    const { transporter } = getTransporter();
    await transporter.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
