import { timeAgo } from "../lib/time.js";

// expMin null means the posting never stated a requirement — say nothing
// rather than implying zero
function experienceLabel(job) {
  if (job.expMin === null || job.expMin === undefined) return "";
  if (job.expMax === null || job.expMax === undefined) return `${job.expMin}+ yrs`;
  if (job.expMax === job.expMin) return `${job.expMin} yrs`;
  return `${job.expMin}–${job.expMax} yrs`;
}

// LinkedIn's own label, title-cased for display ("contract" -> "Contract").
function employmentTypeLabel(job) {
  if (!job.employmentType) return "";
  return job.employmentType.replace(/(^|-)([a-z])/g, (_, sep, c) => `${sep}${c.toUpperCase()}`);
}

// Assisted apply disabled 2026-08-16 — the "Queue apply" button and its
// useApply/useUi wiring are commented out below. The plain "Apply" link stays:
// it's just an external link to the listing, with no backend involved.
export default function JobCard({ job, index }) {
  const experience = experienceLabel(job);
  const engagement = employmentTypeLabel(job);

  return (
    <article
      className="card card-enter"
      style={{ "--stagger": Math.min(index, 12) }}
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-[15px] font-medium">{job.title}</h3>
        {engagement && (
          <span className="hiring-badge" title="Engagement type, as stated by the posting">
            {engagement}
          </span>
        )}
      </div>
      <p className="text-[13px] text-muted mt-2">
        {job.company}
        {job.location ? ` · ${job.location}` : ""}
      </p>

      <div className="flex items-center justify-between mt-4">
        <span className="text-[13px] text-muted">
          {timeAgo(job.postedAt)}
          {experience && (
            <span title={job.expText ? `Posting says: “${job.expText}”` : undefined}>
              {" · "}
              {experience}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {/* <button
            className="apply-btn-ghost"
            onClick={onQueue}
            disabled={queued}
            aria-label={`Queue ${job.title} for assisted apply`}
          >
            {queued ? "Queued ✓" : "Queue apply"}
          </button> */}
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="apply-btn"
            aria-label={`Apply to ${job.title} at ${job.company} on LinkedIn`}
          >
            Apply
          </a>
        </div>
      </div>
    </article>
  );
}
