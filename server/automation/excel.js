// Recipient sheet parser — ported from job-automation's lib/excel.ts,
// using the `xlsx` package already a dependency here for the leads export.
import * as XLSX from "xlsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_SPLIT_RE = /[;,|\n]+/;

function pick(row, keys) {
  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().trim().replace(/[\s_-]+/g, "");
    if (keys.includes(norm)) {
      const v = row[k];
      if (v == null) return undefined;
      const s = String(v).trim();
      return s.length ? s : undefined;
    }
  }
  return undefined;
}

// The Companies "Export Excel" download (see routes/companies.routes.js) packs
// several addresses into one cell across columns like "HR / Recruiting Emails"
// and "Other Emails" — one company per row, not one email per row. Scan every
// column whose header mentions "mail" and split its cell instead of requiring
// an exact single-email column, so that export can be re-uploaded here too.
function collectRowEmails(row) {
  const found = [];
  const seenInRow = new Set();
  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().trim().replace(/[\s_-]+/g, "");
    if (!norm.includes("mail")) continue;
    const v = row[k];
    if (v == null) continue;
    for (const raw of String(v).split(EMAIL_SPLIT_RE)) {
      const email = raw.trim().toLowerCase();
      if (!EMAIL_RE.test(email) || seenInRow.has(email)) continue;
      seenInRow.add(email);
      found.push(email);
    }
  }
  return found;
}

// Company Leads rows have no single "name" column, but "HR Contacts" lists
// entries like "Jane Doe (Recruiter); John Smith (HR Manager)" — fall back to
// the first contact, stripped of its trailing "(title)".
function firstContactName(row) {
  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().trim().replace(/[\s_-]+/g, "");
    if (!norm.includes("contact")) continue;
    const v = row[k];
    if (v == null) continue;
    const first = String(v).split(/[;\n]+/)[0].trim().replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (first) return first;
  }
  return undefined;
}

export function parseSheet(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const emails = collectRowEmails(row);
    if (!emails.length) continue;

    const company = pick(row, ["company", "companyname", "organization", "org", "employer"]);
    const role = pick(row, ["role", "position", "jobtitle", "title", "job"]);
    const name =
      pick(row, ["name", "hrname", "recruiter", "contact", "contactname", "fullname"]) ||
      firstContactName(row);

    for (const email of emails) {
      if (seen.has(email)) continue;
      seen.add(email);
      out.push({ email, name, company, role });
    }
  }
  return out;
}
