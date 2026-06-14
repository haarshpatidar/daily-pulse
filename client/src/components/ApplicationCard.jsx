import { useApply } from "../store/useApply.js";
import { apiUrl } from "../lib/api.js";
import { ExternalLinkIcon } from "./icons.jsx";

const STATUS_META = {
  queued: { label: "Queued", cls: "status-queued" },
  preparing: { label: "Opening browser…", cls: "status-preparing" },
  needs_login: { label: "Needs login", cls: "status-warn" },
  ready_for_review: { label: "Ready to review", cls: "status-ready" },
  submitted: { label: "Submitted", cls: "status-done" },
  skipped: { label: "Skipped", cls: "status-muted" },
  failed: { label: "Failed", cls: "status-error" },
  external: { label: "Apply manually", cls: "status-warn" },
};

// human-readable names for the autofill field keys
const FIELD_LABELS = {
  email: "email", phone: "phone", firstName: "first name", lastName: "last name",
  fullName: "name", city: "city", country: "country", location: "location",
  headline: "headline", currentCompany: "current company", currentTitle: "current title",
  experience: "experience", currentCtc: "current CTC", expectedCtc: "expected CTC",
  noticePeriod: "notice period", linkedin: "LinkedIn", github: "GitHub",
  portfolio: "portfolio", coverLetter: "cover letter", sponsorship: "sponsorship",
  workAuth: "work authorization", resume: "résumé",
};
const pretty = (k) => (k.startsWith("answer:") ? k.slice(7) : FIELD_LABELS[k] || k);

export default function ApplicationCard({ application: a, index }) {
  const { prepare, updateStatus, remove, busy } = useApply();
  const meta = STATUS_META[a.status] || STATUS_META.queued;

  const canPrepare = !busy && ["queued", "needs_login", "failed", "ready_for_review"].includes(a.status);

  return (
    <article className="card card-enter" style={{ "--stagger": Math.min(index, 12) }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-medium truncate">{a.title}</h3>
          <p className="text-[13px] text-muted mt-1">
            {a.company}
            {a.location ? ` · ${a.location}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="platform-badge">{a.platform}</span>
          <span className={`status-badge ${meta.cls}`}>{meta.label}</span>
        </div>
      </div>

      {a.status === "failed" && a.error && (
        <p className="text-[13px] text-error mt-3">{a.error}</p>
      )}

      {a.status === "needs_login" && (
        <p className="text-[13px] text-muted mt-3">
          Not signed in to {a.platform}. Log in from the platform list above, then prepare again.
        </p>
      )}

      {(a.status === "ready_for_review" || a.status === "submitted") &&
        (a.filled?.length > 0 || a.unfilled?.length > 0) && (
          <div className="mt-3 flex flex-col gap-1">
            {a.filled?.length > 0 && (
              <p className="text-[13px] text-muted">
                <span className="text-ok">Filled:</span> {a.filled.map(pretty).join(", ")}
              </p>
            )}
            {a.unfilled?.length > 0 && (
              <p className="text-[13px] text-muted">
                <span className="text-warn">Finish by hand:</span> {a.unfilled.join(", ")}
              </p>
            )}
          </div>
        )}

      {a.status === "ready_for_review" && a.screenshotPath && (
        <a
          href={a.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open the apply page"
          className="block mt-3"
        >
          <img
            className="apply-shot"
            src={apiUrl(`/uploads/${a.screenshotPath}?t=${a.preparedAt || ""}`)}
            alt="Pre-filled application preview"
            loading="lazy"
          />
        </a>
      )}

      {a.status === "ready_for_review" && (
        <p className="text-[13px] text-accent mt-3">
          → Switch to the open Chrome window, review the form, and click Submit there.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-4">
        {canPrepare && (
          <button className="save-btn save-btn-sm" onClick={() => prepare(a._id)}>
            {a.status === "queued" ? "Prepare" : a.status === "ready_for_review" ? "Re-prepare" : "Retry"}
          </button>
        )}
        {a.status === "preparing" && (
          <span className="text-[13px] text-muted">Opening a browser window…</span>
        )}
        {a.status === "ready_for_review" && (
          <button className="pill active" onClick={() => updateStatus(a._id, "submitted")}>
            Mark submitted
          </button>
        )}

        <a href={a.applyUrl} target="_blank" rel="noopener noreferrer" className="apply-btn-ghost">
          <ExternalLinkIcon /> Open
        </a>

        {a.status !== "submitted" && a.status !== "skipped" && (
          <button className="text-[13px] text-muted hover:underline" onClick={() => updateStatus(a._id, "skipped")}>
            Skip
          </button>
        )}
        {a.status === "skipped" && (
          <button className="text-[13px] text-accent hover:underline" onClick={() => updateStatus(a._id, "queued")}>
            Re-queue
          </button>
        )}
        <button className="text-[13px] text-error hover:underline ml-auto" onClick={() => remove(a._id)}>
          Remove
        </button>
      </div>
    </article>
  );
}
