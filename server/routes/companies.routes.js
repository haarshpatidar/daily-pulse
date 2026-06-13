import { Router } from "express";
import * as XLSX from "xlsx";
import Company from "../models/Company.js";
import CompanySearch from "../models/CompanySearch.js";
import { scrapeCompaniesForSearch } from "../scrapers/companies.scraper.js";

const router = Router();

// Translate query-string filters into a Mongo query. Shared by the list and
// the Excel export so a download always matches what's on screen.
function buildQuery(q) {
  const query = {};
  if (q.keyword) query.keyword = String(q.keyword).trim().toLowerCase();
  if (q.q) query.name = new RegExp(String(q.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (q.hiring === "true") query.hiring = true;
  if (q.hasHrEmail === "true") query.hrEmailCount = { $gt: 0 };
  if (q.hasEmail === "true") query.emailCount = { $gt: 0 };

  const minEmp = Number(q.minEmployees);
  const maxEmp = Number(q.maxEmployees);
  if (Number.isFinite(minEmp) && minEmp > 0) query.employeeCount = { ...query.employeeCount, $gte: minEmp };
  if (Number.isFinite(maxEmp) && maxEmp > 0) query.employeeCount = { ...query.employeeCount, $lte: maxEmp };

  const foundedAfter = Number(q.foundedAfter);
  if (Number.isFinite(foundedAfter) && foundedAfter > 1800) query.foundedYear = { $gte: foundedAfter };

  const minRating = Number(q.minRating);
  if (Number.isFinite(minRating) && minRating > 0) query.rating = { $gte: minRating };

  return query;
}

// Newest, email-richest leads first so the most useful rows surface at the top.
const SORT = { hrEmailCount: -1, emailCount: -1, updatedAt: -1 };

// GET /api/companies?hasHrEmail=true&minEmployees=50&foundedAfter=2010&...
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const query = buildQuery(req.query);
    const companies = await Company.find(query).sort(SORT).limit(limit).lean();

    const emailCount = companies.reduce((n, c) => n + (c.emailCount || 0), 0);
    const hrEmailCount = companies.reduce((n, c) => n + (c.hrEmailCount || 0), 0);
    const withHrEmail = companies.filter((c) => (c.hrEmailCount || 0) > 0).length;

    res.json({ count: companies.length, emailCount, hrEmailCount, withHrEmail, companies });
  } catch (err) {
    console.error("[api/companies]", err.message);
    res.status(500).json({ error: "Failed to load companies" });
  }
});

// POST /api/companies/preferences { companies: "Acme\nGlobex", fromJobs: true, keyword }
// Saves the company-lead search (single-user: replaces the previous one) and
// kicks off an immediate first enrichment run.
router.post("/preferences", async (req, res) => {
  try {
    const companies = String(req.body?.companies || "")
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 120);
    const fromJobs = req.body?.fromJobs !== false; // default on
    const keyword = String(req.body?.keyword || "leads").trim().slice(0, 100);

    if (companies.length === 0 && !fromJobs) {
      return res.status(400).json({ error: "Add at least one company name or enable 'from job results'." });
    }

    await CompanySearch.deleteMany({});
    const search = await CompanySearch.create({ companies, fromJobs, keyword });

    // fire-and-forget; the client polls GET /api/companies for results
    scrapeCompaniesForSearch(search._id).catch((err) =>
      console.warn("[api/companies] initial enrich failed:", err.message)
    );

    res.json({ ok: true, message: "Lead search saved — enrichment is running" });
  } catch (err) {
    console.error("[api/companies/preferences]", err.message);
    res.status(500).json({ error: "Failed to save lead preferences" });
  }
});

const emailsOfType = (c, types) =>
  (c.emails || [])
    .filter((e) => types.includes(e.type))
    .map((e) => e.address)
    .join("; ");

// GET /api/companies/export?...same filters... → .xlsx download
router.get("/export", async (req, res) => {
  try {
    const query = buildQuery(req.query);
    const companies = await Company.find(query).sort(SORT).limit(2000).lean();

    const rows = companies.map((c) => ({
      Company: c.name,
      Website: c.website || "",
      Domain: c.domain || "",
      "HR / Recruiting Emails": emailsOfType(c, ["hr"]),
      "Other Emails": emailsOfType(c, ["general", "other"]),
      "HR Contacts": (c.hrContacts || []).map((h) => (h.title ? `${h.name} (${h.title})` : h.name)).join("; "),
      "Total Emails": c.emailCount || 0,
      "HR Emails": c.hrEmailCount || 0,
      Founded: c.foundedYear || "",
      Employees: c.employeeCount || c.employeeRange || "",
      Industry: c.industry || "",
      Location: c.location || "",
      Rating: c.rating ?? "",
      Reviews: c.reviewCount ?? "",
      Hiring: c.hiring ? "Yes" : "No",
      "Open Jobs": c.jobCount || 0,
      Status: c.status,
      "Scraped At": c.scrapedAt ? new Date(c.scrapedAt).toISOString().slice(0, 10) : "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Company: "No leads yet" }]);
    ws["!cols"] = [
      { wch: 26 }, { wch: 30 }, { wch: 20 }, { wch: 36 }, { wch: 36 }, { wch: 30 },
      { wch: 11 }, { wch: 10 }, { wch: 9 }, { wch: 12 }, { wch: 16 }, { wch: 18 },
      { wch: 8 }, { wch: 9 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Company Leads");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="company-leads-${stamp}.xlsx"`);
    res.send(buf);
  } catch (err) {
    console.error("[api/companies/export]", err.message);
    res.status(500).json({ error: "Failed to export leads" });
  }
});

export default router;
