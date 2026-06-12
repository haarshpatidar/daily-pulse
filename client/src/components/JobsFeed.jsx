import { useJobs } from "../store/useJobs.js";
import { usePrefs } from "../store/usePrefs.js";
import { useUi } from "../store/useUi.js";
import { TIME_RANGES } from "../lib/time.js";
import FilterPills from "./FilterPills.jsx";
import JobCard from "./JobCard.jsx";
import EmptyState from "./EmptyState.jsx";
import { SkeletonJobCard } from "./Skeleton.jsx";

export default function JobsFeed({ limit, compact = false }) {
  const { jobs, loading, error, scraping, timeRange, setTimeRange, clearFilters, fetch } =
    useJobs();
  const jobKeywords = usePrefs((s) => s.jobKeywords);
  const setView = useUi((s) => s.setView);
  const openDrawer = useUi((s) => s.openDrawer);

  const shown = limit ? jobs.slice(0, limit) : jobs;

  return (
    <section className="mt-8 first:mt-0" aria-label="Jobs">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">
          {compact ? "Recent jobs" : "Jobs"}
          {jobKeywords && (
            <span className="text-muted font-normal text-[13px] ml-2">
              “{jobKeywords}”
            </span>
          )}
        </h2>
        {compact && (
          <button
            className="text-[13px] text-accent hover:underline"
            onClick={() => setView("jobs")}
          >
            View all
          </button>
        )}
      </div>

      {!compact && jobKeywords && (
        <div className="mb-6">
          <FilterPills
            label="Time range"
            options={TIME_RANGES}
            value={timeRange}
            onChange={setTimeRange}
          />
        </div>
      )}

      {!jobKeywords ? (
        <EmptyState
          message="Set your job keywords to see matching LinkedIn listings."
          actionLabel="Open preferences"
          onAction={openDrawer}
        />
      ) : loading || (scraping && jobs.length === 0) ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: compact ? 2 : 4 }, (_, i) => (
            <SkeletonJobCard key={i} />
          ))}
          {scraping && (
            <p className="text-[13px] text-muted text-center">
              Fetching fresh listings from LinkedIn — this can take up to a minute…
            </p>
          )}
        </div>
      ) : error ? (
        <EmptyState
          message="Couldn't load jobs — is the server running?"
          actionLabel="Retry"
          onAction={() => fetch()}
        />
      ) : shown.length === 0 ? (
        <EmptyState
          message="No jobs match these filters."
          actionLabel="Clear filters"
          onAction={clearFilters}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {shown.map((job, i) => (
            <JobCard key={job.url} job={job} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
