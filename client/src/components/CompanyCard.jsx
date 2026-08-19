import { useState } from "react";
import { CopyIcon, CheckIcon, MapPinIcon } from "./icons.jsx";

function EmailChip({ email }) {
  const [copied, setCopied] = useState(false);

  const copy = async (e) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(email.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked — the mailto link still works */
    }
  };

  return (
    <span className={`email-chip ${email.type === "hr" ? "hr" : ""}`}>
      <a href={`mailto:${email.address}`} title={`Source: ${email.source || "site"}`}>
        {email.address}
      </a>
      <button
        className="email-copy"
        onClick={copy}
        aria-label={`Copy ${email.address}`}
        title="Copy"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </span>
  );
}

function Meta({ children }) {
  if (!children) return null;
  return <span className="lead-meta">{children}</span>;
}

export default function CompanyCard({ company, index }) {
  const hrEmails = (company.emails || []).filter((e) => e.type === "hr");
  const otherEmails = (company.emails || []).filter((e) => e.type !== "hr");
  const employees = company.employeeCount
    ? company.employeeCount.toLocaleString()
    : company.employeeRange;

  return (
    <article className="card card-enter" style={{ "--stagger": Math.min(index, 12) }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-medium truncate">{company.name}</h3>
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-accent hover:underline break-all"
            >
              {company.domain || company.website}
            </a>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {company.hiring && (
            <span className="hiring-badge" title={`${company.jobCount} open listing(s)`}>
              Hiring{company.jobCount ? ` · ${company.jobCount}` : ""}
            </span>
          )}
          {company.hiringContract && (
            <span
              className="hiring-badge"
              title={`${company.contractJobCount} open contract/freelance listing(s)`}
            >
              Contract work{company.contractJobCount ? ` · ${company.contractJobCount}` : ""}
            </span>
          )}
        </div>
      </div>

      {(employees || company.foundedYear || company.location || company.rating != null) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
          <Meta>{company.foundedYear ? `Est. ${company.foundedYear}` : null}</Meta>
          <Meta>{employees ? `${employees} employees` : null}</Meta>
          <Meta>
            {company.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon /> {company.location}
              </span>
            ) : null}
          </Meta>
          <Meta>
            {company.rating != null
              ? `★ ${company.rating}${company.reviewCount ? ` (${company.reviewCount})` : ""}`
              : null}
          </Meta>
        </div>
      )}

      <div className="mt-4">
        {hrEmails.length > 0 && (
          <div className="mb-2">
            <span className="source-label mb-1">HR / Recruiting</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {hrEmails.map((e) => (
                <EmailChip key={e.address} email={e} />
              ))}
            </div>
          </div>
        )}
        {otherEmails.length > 0 && (
          <div>
            <span className="source-label mb-1">Other contacts</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {otherEmails.map((e) => (
                <EmailChip key={e.address} email={e} />
              ))}
            </div>
          </div>
        )}
        {hrEmails.length === 0 && otherEmails.length === 0 && (
          <p className="text-[13px] text-muted">
            No public email found{company.website ? " on the site" : " — website not resolved"}.
          </p>
        )}
      </div>

      {company.hrNames?.length > 0 && (
        <p className="text-[13px] text-muted mt-3">
          HR contacts: {company.hrNames.join(", ")}
        </p>
      )}
    </article>
  );
}
