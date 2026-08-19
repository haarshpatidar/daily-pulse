import { useEffect, useState } from "react";
import { useAutomation } from "../../store/useAutomation.js";
import { ShieldCheckIcon, CheckIcon, TrashIcon } from "../icons.jsx";

const PRESETS = {
  gmail: { host: "smtp.gmail.com", port: 587, secure: false, label: "Gmail" },
  outlook: { host: "smtp.office365.com", port: 587, secure: false, label: "Outlook / Microsoft 365" },
  yahoo: { host: "smtp.mail.yahoo.com", port: 465, secure: true, label: "Yahoo" },
  zoho: { host: "smtp.zoho.com", port: 465, secure: true, label: "Zoho" },
};

export default function SmtpSettings() {
  const smtpCreds = useAutomation((s) => s.smtpCreds);
  const smtpLoaded = useAutomation((s) => s.smtpLoaded);
  const saveSmtp = useAutomation((s) => s.saveSmtp);
  const testSmtp = useAutomation((s) => s.testSmtp);
  const deleteSmtp = useAutomation((s) => s.deleteSmtp);

  const [host, setHost] = useState("smtp.gmail.com");
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!smtpCreds) return;
    setHost(smtpCreds.host);
    setPort(smtpCreds.port);
    setSecure(smtpCreds.secure);
    setSmtpUser(smtpCreds.smtpUser);
    setSenderName(smtpCreds.senderName || "");
    setSenderEmail(smtpCreds.senderEmail || "");
    setReplyTo(smtpCreds.replyTo || "");
  }, [smtpCreds]);

  function applyPreset(key) {
    const p = PRESETS[key];
    if (!p) return;
    setHost(p.host);
    setPort(p.port);
    setSecure(p.secure);
  }

  async function save(verify) {
    setBusy(true);
    setToast(null);
    setError(null);
    try {
      if (!smtpPass && !smtpCreds) throw new Error("Enter your app password");
      const j = await saveSmtp({
        host,
        port,
        secure,
        smtpUser,
        smtpPass: smtpPass || undefined,
        senderName,
        senderEmail,
        replyTo,
        verify,
      });
      setSmtpPass("");
      if (verify) {
        if (j.verified?.ok) setToast("Saved and verified — you can now send emails");
        else setError(`Saved, but verification failed: ${j.verified?.error || "Unknown error"}`);
      } else {
        setToast("Saved");
      }
    } catch (e) {
      setError(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setBusy(true);
    setToast(null);
    setError(null);
    try {
      const j = await testSmtp();
      if (j.ok) setToast("Connection OK — credentials work");
      else setError(`Verification failed: ${j.error}`);
    } finally {
      setBusy(false);
    }
  }

  async function clearCreds() {
    if (!confirm("Remove your saved SMTP credentials? You will need to re-enter them to send emails again.")) {
      return;
    }
    setBusy(true);
    try {
      await deleteSmtp();
      setSmtpPass("");
      setToast("Removed");
    } finally {
      setBusy(false);
    }
  }

  if (!smtpLoaded) return null;

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold">Email settings (SMTP)</h3>
        {smtpCreds && (
          <span className="status-badge status-done">
            Saved · updated {new Date(`${smtpCreds.updatedAt}Z`).toLocaleString()}
          </span>
        )}
      </div>

      <p className="text-[13px] text-muted">
        Emails are sent from your own inbox. Your password is encrypted at rest and only used by
        this server to send mail on your behalf.
      </p>

      <div className="text-[13px] p-3 rounded-lg border border-line bg-app">
        <strong>Gmail/Outlook users:</strong> use an App Password, not your normal account
        password. For Gmail, enable 2-Step Verification, then create one at{" "}
        <a
          href="https://myaccount.google.com/apppasswords"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          myaccount.google.com/apppasswords
        </a>
        .
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-muted">Quick presets:</span>
        {Object.entries(PRESETS).map(([k, p]) => (
          <button key={k} type="button" className="pill" onClick={() => applyPreset(k)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[13px] text-muted">SMTP host</span>
          <input className="drawer-input mt-1 w-full" value={host} onChange={(e) => setHost(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[13px] text-muted">Port</span>
          <input
            className="drawer-input mt-1 w-full"
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
          />
        </label>
        <label className="sm:col-span-2 flex items-center gap-2 text-[13px] cursor-pointer">
          <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} />
          Use TLS/SSL (typically on for port 465, off for 587)
        </label>

        <label className="block">
          <span className="text-[13px] text-muted">SMTP username (email)</span>
          <input
            className="drawer-input mt-1 w-full"
            type="email"
            value={smtpUser}
            onChange={(e) => setSmtpUser(e.target.value)}
            placeholder="you@gmail.com"
          />
        </label>
        <label className="block">
          <span className="text-[13px] text-muted">
            {smtpCreds ? "App password (leave blank to keep)" : "App password"}
          </span>
          <input
            className="drawer-input mt-1 w-full"
            type="password"
            value={smtpPass}
            onChange={(e) => setSmtpPass(e.target.value)}
            placeholder={smtpCreds ? "••••••••••••" : "Paste your app password"}
            autoComplete="new-password"
          />
        </label>

        <label className="block">
          <span className="text-[13px] text-muted">Sender name (From)</span>
          <input
            className="drawer-input mt-1 w-full"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Your Full Name"
          />
        </label>
        <label className="block">
          <span className="text-[13px] text-muted">Sender email (From)</span>
          <input
            className="drawer-input mt-1 w-full"
            type="email"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
          />
        </label>
        <label className="sm:col-span-2 block">
          <span className="text-[13px] text-muted">Reply-to (optional)</span>
          <input
            className="drawer-input mt-1 w-full"
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="Defaults to your sender email"
          />
        </label>
      </div>

      {toast && <p className="text-[13px] text-ok">{toast}</p>}
      {error && <p className="text-[13px] text-error">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button className="apply-btn" disabled={busy} onClick={() => save(true)}>
          <ShieldCheckIcon />
          {busy ? "Saving…" : "Save & verify"}
        </button>
        <button className="apply-btn-ghost" disabled={busy} onClick={() => save(false)}>
          <CheckIcon />
          Save
        </button>
        {smtpCreds && (
          <button className="apply-btn-ghost" disabled={busy} onClick={testConnection}>
            <ShieldCheckIcon />
            Test connection
          </button>
        )}
        {smtpCreds && (
          <button className="apply-btn-ghost text-error ml-auto" disabled={busy} onClick={clearCreds}>
            <TrashIcon />
            Remove credentials
          </button>
        )}
      </div>
    </div>
  );
}
