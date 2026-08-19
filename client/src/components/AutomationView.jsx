import { useEffect, useState } from "react";
import { useAutomation } from "../store/useAutomation.js";
import StatsCards from "./automation/StatsCards.jsx";
import ControlPanel from "./automation/ControlPanel.jsx";
import UploadSection from "./automation/UploadSection.jsx";
import TemplateEditor from "./automation/TemplateEditor.jsx";
import RecipientsTable from "./automation/RecipientsTable.jsx";
import SmtpSettings from "./automation/SmtpSettings.jsx";
import { SettingsIcon } from "./icons.jsx";

const POLL_MS = 2000;

export default function AutomationView() {
  const stats = useAutomation((s) => s.stats);
  const status = useAutomation((s) => s.status);
  const smtpCreds = useAutomation((s) => s.smtpCreds);
  const smtpLoaded = useAutomation((s) => s.smtpLoaded);
  const start = useAutomation((s) => s.start);
  const stop = useAutomation((s) => s.stop);
  const refresh = useAutomation((s) => s.refresh);
  const fetchRecipients = useAutomation((s) => s.fetchRecipients);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Loaded lazily (unlike Jobs/Leads/Freelance) — nothing here shows on the
  // Dashboard, so there's no reason to hit five endpoints on every app load.
  useEffect(() => {
    useAutomation.getState().init();
  }, []);

  // Live view of a run in progress — recipient statuses flip as sends land.
  useEffect(() => {
    const id = setInterval(() => {
      refresh();
      fetchRecipients();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refresh, fetchRecipients]);

  useEffect(() => {
    if (smtpLoaded && !smtpCreds) setSettingsOpen(true);
  }, [smtpLoaded, smtpCreds]);

  async function handleStart() {
    setBusy(true);
    setToast(null);
    try {
      const j = await start();
      setToast(j.message || (j.ok ? "Started" : "Failed to start"));
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    setBusy(true);
    try {
      const j = await stop();
      setToast(j.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="section-title">Automation</h2>
          <p className="text-[13px] text-muted mt-1">
            Send personalized application emails, with your resume attached, to recruiters from an
            uploaded sheet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {toast && <span className="text-[13px] text-muted">{toast}</span>}
          <button
            className={`apply-btn-ghost ${settingsOpen ? "text-accent" : ""}`}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <SettingsIcon width={16} height={16} />
            Email settings
          </button>
        </div>
      </div>

      {smtpLoaded && !smtpCreds && !settingsOpen && (
        <div className="card p-4 border border-line text-[13px]">
          You haven't added your email credentials yet.{" "}
          <button className="text-accent hover:underline font-medium" onClick={() => setSettingsOpen(true)}>
            Add them in Email settings
          </button>{" "}
          to start sending.
        </div>
      )}

      {settingsOpen && <SmtpSettings />}

      <StatsCards stats={stats} />
      <ControlPanel status={status} onStart={handleStart} onStop={handleStop} busy={busy} />
      <UploadSection />
      <TemplateEditor />
      <RecipientsTable />
    </div>
  );
}
