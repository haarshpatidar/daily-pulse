import { timeAgo } from "../lib/time.js";

export default function JobCard({ job, index }) {
  return (
    <article
      className="card card-enter"
      style={{ "--stagger": Math.min(index, 12) }}
    >
      <h3 className="text-[15px] font-medium">{job.title}</h3>
      <p className="text-[13px] text-muted mt-2">
        {job.company}
        {job.location ? ` · ${job.location}` : ""}
      </p>

      <div className="flex items-center justify-between mt-4">
        <span className="text-[13px] text-muted">{timeAgo(job.postedAt)}</span>
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
    </article>
  );
}
