import { useEffect, useState } from "react";
import { useFreelance } from "../store/useFreelance.js";
import { usePrefs } from "../store/usePrefs.js";
import { useUi } from "../store/useUi.js";
import JobCard from "./JobCard.jsx";
import CompanyCard from "./CompanyCard.jsx";
import EmptyState from "./EmptyState.jsx";
import Pagination from "./Pagination.jsx";
import { SkeletonJobCard, SkeletonCompanyCard } from "./Skeleton.jsx";

const JOB_PAGE_SIZE = 15;
const COMPANY_PAGE_SIZE = 12;

export default function FreelanceFeed() {
  const { jobs, companies, loading, error, fetch } = useFreelance();
  const jobKeywords = usePrefs((s) => s.jobKeywords);
  const openDrawer = useUi((s) => s.openDrawer);

  const [jobPage, setJobPage] = useState(1);
  const [companyPage, setCompanyPage] = useState(1);
  useEffect(() => {
    setJobPage(1);
    setCompanyPage(1);
  }, [jobs.length, companies.length]);

  const jobTotalPages = Math.max(1, Math.ceil(jobs.length / JOB_PAGE_SIZE));
  const safeJobPage = Math.min(jobPage, jobTotalPages);
  const visibleJobs = jobs.slice(
    (safeJobPage - 1) * JOB_PAGE_SIZE,
    safeJobPage * JOB_PAGE_SIZE
  );

  const companyTotalPages = Math.max(1, Math.ceil(companies.length / COMPANY_PAGE_SIZE));
  const safeCompanyPage = Math.min(companyPage, companyTotalPages);
  const visibleCompanies = companies.slice(
    (safeCompanyPage - 1) * COMPANY_PAGE_SIZE,
    safeCompanyPage * COMPANY_PAGE_SIZE
  );

  if (error) {
    return (
      <section className="mt-8 first:mt-0" aria-label="Freelance">
        <h2 className="section-title mb-4">Freelance</h2>
        <EmptyState
          message="Couldn't load freelance listings — is the server running?"
          actionLabel="Retry"
          onAction={() => fetch()}
        />
      </section>
    );
  }

  return (
    <>
      <section className="mt-8 first:mt-0" aria-label="Contract & freelance jobs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">
            Contract &amp; freelance jobs
            {jobKeywords && (
              <span className="text-muted font-normal text-[13px] ml-2">“{jobKeywords}”</span>
            )}
          </h2>
          {!loading && jobs.length > 0 && (
            <span className="text-[13px] text-muted">
              {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
            </span>
          )}
        </div>

        {!jobKeywords ? (
          <EmptyState
            message="Set your job keywords to see contract/freelance listings among them."
            actionLabel="Open preferences"
            onAction={openDrawer}
          />
        ) : loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonJobCard key={i} />
            ))}
          </div>
        ) : visibleJobs.length === 0 ? (
          <EmptyState message="No contract/freelance jobs found among your current listings yet." />
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {visibleJobs.map((job, i) => (
                <JobCard key={job.url} job={job} index={i} />
              ))}
            </div>
            <Pagination
              total={jobs.length}
              page={safeJobPage}
              pageSize={JOB_PAGE_SIZE}
              onChange={setJobPage}
            />
          </>
        )}
      </section>

      <section className="mt-8" aria-label="Companies hiring for contract work">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Companies hiring for contract work</h2>
          {!loading && companies.length > 0 && (
            <span className="text-[13px] text-muted">
              {companies.length} {companies.length === 1 ? "company" : "companies"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonCompanyCard key={i} />
            ))}
          </div>
        ) : visibleCompanies.length === 0 ? (
          <EmptyState
            message="No company leads with open contract roles yet — set up a lead search in preferences."
            actionLabel="Open preferences"
            onAction={openDrawer}
          />
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {visibleCompanies.map((c, i) => (
                <CompanyCard key={c._id || c.nameKey} company={c} index={i} />
              ))}
            </div>
            <Pagination
              total={companies.length}
              page={safeCompanyPage}
              pageSize={COMPANY_PAGE_SIZE}
              onChange={setCompanyPage}
            />
          </>
        )}
      </section>
    </>
  );
}
