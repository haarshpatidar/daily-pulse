import { useEffect, useRef, useState } from "react";
import { useApply } from "../store/useApply.js";
import { apiUrl } from "../lib/api.js";
import ApplicationCard from "./ApplicationCard.jsx";
import EmptyState from "./EmptyState.jsx";
import { DownloadIcon } from "./icons.jsx";

const EMPTY = {
  firstName: "", lastName: "", email: "", phone: "", city: "", country: "",
  headline: "", currentTitle: "", currentCompany: "", totalExperienceYears: "",
  currentCtc: "", expectedCtc: "", noticePeriodDays: "",
  workAuthorized: true, requiresSponsorship: false,
  linkedinUrl: "", githubUrl: "", portfolioUrl: "", coverLetterTemplate: "",
};

function Field({ label, value, onChange, type = "text", placeholder, full }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[13px] text-muted">{label}</span>
      <input
        className="drawer-input mt-1"
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

// Group the tracker columns; order matters (most actionable first).
const COLUMNS = [
  { key: "ready_for_review", title: "Ready to review", match: (s) => s === "ready_for_review" || s === "preparing" || s === "needs_login" },
  { key: "queued", title: "Queued", match: (s) => s === "queued" || s === "failed" },
  { key: "submitted", title: "Submitted", match: (s) => s === "submitted" || s === "skipped" },
];

export default function ApplyView() {
  const {
    profile, applications, platforms, loading, saving, error,
    saveProfile, uploadResume, loadApplications, login,
  } = useApply();

  const [form, setForm] = useState(EMPTY);
  const [extras, setExtras] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const fileRef = useRef(null);

  // refresh the tracker when the tab opens
  useEffect(() => {
    loadApplications({ background: true });
  }, [loadApplications]);

  // seed the form from the saved profile once it loads
  useEffect(() => {
    if (!profile) return;
    setForm({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, profile[k] ?? EMPTY[k]])) });
    setExtras(profile.extraAnswers?.length ? profile.extraAnswers : []);
  }, [profile]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const ok = await saveProfile({
      ...form,
      extraAnswers: extras.filter((a) => a.label?.trim()),
    });
    if (ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await uploadResume(file);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const resume = profile?.resumeFile?.storedName ? profile.resumeFile : null;

  if (loading) {
    return <p className="text-[14px] text-muted py-16 text-center">Loading your apply setup…</p>;
  }

  return (
    <section aria-label="Assisted apply">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">Apply</h2>
        <span className="text-[13px] text-muted">
          {applications.length} in tracker
        </span>
      </div>

      {/* Honest, one-time note about what this does */}
      <div className="apply-disclaimer">
        This pre-fills each application in a <strong>visible browser window</strong> from your
        profile and résumé — <strong>you review and click Submit yourself</strong>. Automating
        logged-in actions can violate a site's terms; keep volumes modest. Nothing is ever
        submitted automatically.
      </div>

      {error && <p className="text-[13px] text-error mt-3">{error}</p>}

      {/* ---- Profile ---- */}
      <div className="card mt-6">
        <span className="source-label mb-1">Your details</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <Field label="First name" value={form.firstName} onChange={set("firstName")} />
          <Field label="Last name" value={form.lastName} onChange={set("lastName")} />
          <Field label="Email" value={form.email} onChange={set("email")} type="email" />
          <Field label="Phone" value={form.phone} onChange={set("phone")} />
          <Field label="City" value={form.city} onChange={set("city")} />
          <Field label="Country" value={form.country} onChange={set("country")} />
          <Field label="Headline" value={form.headline} onChange={set("headline")} full placeholder="e.g. Senior React Developer" />
          <Field label="Current title" value={form.currentTitle} onChange={set("currentTitle")} />
          <Field label="Current company" value={form.currentCompany} onChange={set("currentCompany")} />
          <Field label="Total experience (years)" value={form.totalExperienceYears} onChange={set("totalExperienceYears")} type="number" />
          <Field label="Notice period (days)" value={form.noticePeriodDays} onChange={set("noticePeriodDays")} type="number" />
          <Field label="Current CTC" value={form.currentCtc} onChange={set("currentCtc")} />
          <Field label="Expected CTC" value={form.expectedCtc} onChange={set("expectedCtc")} />
          <Field label="LinkedIn URL" value={form.linkedinUrl} onChange={set("linkedinUrl")} />
          <Field label="GitHub URL" value={form.githubUrl} onChange={set("githubUrl")} />
          <Field label="Portfolio URL" value={form.portfolioUrl} onChange={set("portfolioUrl")} />
        </div>

        <div className="flex flex-wrap gap-6 mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.workAuthorized} onChange={(e) => set("workAuthorized")(e.target.checked)} />
            <span className="text-[13px]">Authorized to work</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.requiresSponsorship} onChange={(e) => set("requiresSponsorship")(e.target.checked)} />
            <span className="text-[13px]">Requires visa sponsorship</span>
          </label>
        </div>

        <label className="block mt-4">
          <span className="text-[13px] text-muted">Cover letter / "why this role" template</span>
          <textarea
            className="drawer-input mt-1 resize-none"
            rows={4}
            value={form.coverLetterTemplate}
            onChange={(e) => set("coverLetterTemplate")(e.target.value)}
            placeholder="A reusable paragraph dropped into 'cover letter' or 'why do you want to work here' fields."
          />
        </label>

        {/* extra screening answers */}
        <div className="mt-5">
          <span className="source-label mb-1">Saved answers to common questions</span>
          <p className="text-[13px] text-muted mt-1">
            Matched to form fields by label, e.g. "Years of React" → "4".
          </p>
          <div className="flex flex-col gap-2 mt-2">
            {extras.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="drawer-input flex-1"
                  placeholder="Question contains…"
                  value={a.label}
                  onChange={(e) => setExtras((x) => x.map((it, j) => (j === i ? { ...it, label: e.target.value } : it)))}
                />
                <input
                  className="drawer-input flex-1"
                  placeholder="Answer"
                  value={a.value}
                  onChange={(e) => setExtras((x) => x.map((it, j) => (j === i ? { ...it, value: e.target.value } : it)))}
                />
                <button className="icon-btn" aria-label="Remove answer" onClick={() => setExtras((x) => x.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button
              className="text-[13px] text-accent hover:underline self-start"
              onClick={() => setExtras((x) => [...x, { label: "", value: "" }])}
            >
              + Add an answer
            </button>
          </div>
        </div>

        {/* resume */}
        <div className="mt-5">
          <span className="source-label mb-1">Résumé</span>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.rtf,.txt,application/pdf"
              onChange={onFile}
              className="text-[13px]"
            />
            {uploading && <span className="text-[13px] text-muted">Uploading…</span>}
            {resume && (
              <a className="apply-btn-ghost" href={apiUrl("/api/apply/resume")} target="_blank" rel="noopener noreferrer">
                <DownloadIcon /> {resume.originalName}
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button className="save-btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </button>
          {savedFlash && <span className="text-[13px] text-ok">Saved ✓</span>}
        </div>
      </div>

      {/* ---- Platform logins ---- */}
      <div className="card mt-6">
        <span className="source-label mb-1">Sign in to each platform (optional)</span>
        <p className="text-[13px] text-muted mt-1">
          Opens a real browser window — log in there and the session is remembered. You can also
          just hit Prepare and sign in right in the apply window when prompted. LinkedIn is tuned
          for Easy Apply; others are best-effort generic fills.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {platforms.map((p) => (
            <button key={p.id} className="pill" onClick={() => login(p.id)}>
              {p.label}
              {p.tuned ? " ★" : ""}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Tracker ---- */}
      <div className="mt-8">
        {applications.length === 0 ? (
          <EmptyState message="No applications queued yet. Hit 'Queue apply' on any job in the Jobs tab." />
        ) : (
          <div className="apply-board">
            {COLUMNS.map((col) => {
              const items = applications.filter((a) => col.match(a.status));
              return (
                <div key={col.key} className="apply-column">
                  <h3 className="apply-column-title">
                    {col.title} <span className="text-muted">· {items.length}</span>
                  </h3>
                  <div className="flex flex-col gap-3">
                    {items.map((a, i) => (
                      <ApplicationCard key={a._id} application={a} index={i} />
                    ))}
                    {items.length === 0 && <p className="text-[13px] text-muted">—</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
