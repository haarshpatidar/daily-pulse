import { useEffect, useState } from "react";
import { useCompanies } from "../store/useCompanies.js";
import { useUi } from "../store/useUi.js";
import CompanyCard from "./CompanyCard.jsx";
import EmptyState from "./EmptyState.jsx";
import Pagination from "./Pagination.jsx";
import { SkeletonCompanyCard } from "./Skeleton.jsx";
import { DownloadIcon } from "./icons.jsx";

const PAGE_SIZE = 12;

function Filters({ filters, setFilter, clearFilters }) {
  return (
    <div className="lead-filters">
      <input
        className="filter-input"
        type="text"
        value={filters.q}
        onChange={(e) => setFilter("q", e.target.value)}
        placeholder="Search company name"
        aria-label="Search company name"
      />
      <input
        className="filter-input w-28"
        type="number"
        min="0"
        value={filters.minEmployees}
        onChange={(e) => setFilter("minEmployees", e.target.value)}
        placeholder="Min staff"
        aria-label="Minimum employees"
      />
      <input
        className="filter-input w-28"
        type="number"
        min="0"
        value={filters.maxEmployees}
        onChange={(e) => setFilter("maxEmployees", e.target.value)}
        placeholder="Max staff"
        aria-label="Maximum employees"
      />
      <input
        className="filter-input w-32"
        type="number"
        min="1800"
        value={filters.foundedAfter}
        onChange={(e) => setFilter("foundedAfter", e.target.value)}
        placeholder="Founded after"
        aria-label="Founded after year"
      />
      <input
        className="filter-input w-28"
        type="number"
        min="0"
        max="5"
        step="0.1"
        value={filters.minRating}
        onChange={(e) => setFilter("minRating", e.target.value)}
        placeholder="Min rating"
        aria-label="Minimum rating"
      />
      <button
        className={`pill ${filters.hasHrEmail ? "active" : ""}`}
        onClick={() => setFilter("hasHrEmail", !filters.hasHrEmail)}
        aria-pressed={filters.hasHrEmail}
      >
        Has HR email
      </button>
      <button
        className={`pill ${filters.hiring ? "active" : ""}`}
        onClick={() => setFilter("hiring", !filters.hiring)}
        aria-pressed={filters.hiring}
      >
        Hiring now
      </button>
      <button
        className={`pill ${filters.hiringContract ? "active" : ""}`}
        onClick={() => setFilter("hiringContract", !filters.hiringContract)}
        aria-pressed={filters.hiringContract}
      >
        Hiring for contract work
      </button>
      <button className="text-[13px] text-accent hover:underline ml-1" onClick={clearFilters}>
        Reset
      </button>
    </div>
  );
}

export default function CompaniesFeed({ limit, compact = false }) {
  const {
    companies, emailCount, hrEmailCount, loading, error, scraping,
    filters, setFilter, clearFilters, fetch, exportExcel,
  } = useCompanies();
  const setView = useUi((s) => s.setView);
  const openDrawer = useUi((s) => s.openDrawer);

  const hasActiveFilters =
    filters.q ||
    filters.hiring ||
    filters.hiringContract ||
    filters.hasHrEmail ||
    filters.minEmployees ||
    filters.maxEmployees ||
    filters.foundedAfter ||
    filters.minRating;

  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // On the dashboard, stay hidden until there are leads to preview (the feature
  // is opt-in via preferences, so don't show an empty placeholder there).
  if (compact && companies.length === 0 && !scraping) return null;

  const totalPages = Math.max(1, Math.ceil(companies.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = compact
    ? companies.slice(0, limit)
    : companies.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section className="mt-8 first:mt-0" aria-label="Company leads">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="section-title">{compact ? "Company leads" : "Leads"}</h2>
        {compact ? (
          <button className="text-[13px] text-accent hover:underline" onClick={() => setView("leads")}>
            View all
          </button>
        ) : (
          companies.length > 0 && (
            <div className="flex items-center gap-4">
              <span className="text-[13px] text-muted">
                {companies.length} {companies.length === 1 ? "company" : "companies"} ·{" "}
                {hrEmailCount} HR / {emailCount} total emails
              </span>
              <button className="export-btn" onClick={exportExcel}>
                <DownloadIcon /> Export Excel
              </button>
            </div>
          )
        )}
      </div>

      {!compact && (companies.length > 0 || hasActiveFilters) && (
        <div className="mb-6">
          <Filters filters={filters} setFilter={setFilter} clearFilters={clearFilters} />
        </div>
      )}

      {loading || (scraping && companies.length === 0) ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: compact ? 2 : 4 }, (_, i) => (
            <SkeletonCompanyCard key={i} />
          ))}
          {scraping && (
            <p className="text-[13px] text-muted text-center">
              Visiting each company's site to collect public emails — this streams in over a few minutes…
            </p>
          )}
        </div>
      ) : error ? (
        <EmptyState
          message="Couldn't load leads — is the server running?"
          actionLabel="Retry"
          onAction={() => fetch()}
        />
      ) : visible.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            message="No companies match these filters."
            actionLabel="Clear filters"
            onAction={clearFilters}
          />
        ) : (
          <EmptyState
            message="Set up a company-lead search to collect public HR & careers emails."
            actionLabel="Open preferences"
            onAction={openDrawer}
          />
        )
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {visible.map((c, i) => (
              <CompanyCard key={c._id || c.nameKey} company={c} index={i} />
            ))}
          </div>
          {!compact && (
            <Pagination
              total={companies.length}
              page={safePage}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          )}
        </>
      )}
    </section>
  );
}
