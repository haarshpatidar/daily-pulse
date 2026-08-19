// Recipient sheet parser — ported from job-automation's lib/excel.ts,
// using the `xlsx` package already a dependency here for the leads export.
import * as XLSX from "xlsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export function parseSheet(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const email = pick(row, ["email", "emailaddress", "mail", "hremail", "recipient"]);
    if (!email) continue;
    const lower = email.toLowerCase();
    if (!EMAIL_RE.test(lower) || seen.has(lower)) continue;
    seen.add(lower);
    out.push({
      email: lower,
      name: pick(row, ["name", "hrname", "recruiter", "contact", "contactname", "fullname"]),
      company: pick(row, ["company", "companyname", "organization", "org", "employer"]),
      role: pick(row, ["role", "position", "jobtitle", "title", "job"]),
    });
  }
  return out;
}
