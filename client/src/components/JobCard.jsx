import { useState } from "react";
import { timeAgo } from "../lib/time.js";
import { useApply } from "../store/useApply.js";
import { useUi } from "../store/useUi.js";

export default function JobCard({ job, index }) {
  const queue = useApply((s) => s.queue);
  const setView = useUi((s) => s.setView);
  const [queued, setQueued] = useState(false);

  const onQueue = async () => {
    const app = await queue(job);
    if (app) {
      setQueued(true);
      setView("apply");
    }
  };

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
        <div className="flex items-center gap-2">
          <button
            className="apply-btn-ghost"
            onClick={onQueue}
            disabled={queued}
            aria-label={`Queue ${job.title} for assisted apply`}
          >
            {queued ? "Queued ✓" : "Queue apply"}
          </button>
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
