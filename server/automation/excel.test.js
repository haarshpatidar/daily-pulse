// Run with: node --test server/automation/
import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseSheet } from "./excel.js";

function sheetBuffer(rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

test("parses the classic single-email-per-row recruiter sheet unchanged", () => {
  const buf = sheetBuffer([
    { Email: "jane@acme.com", Name: "Jane Doe", Company: "Acme", Role: "Recruiter" },
    { Email: "not-an-email", Name: "Bad Row", Company: "Acme", Role: "Recruiter" },
  ]);
  const out = parseSheet(buf);
  assert.deepEqual(out, [
    { email: "jane@acme.com", name: "Jane Doe", company: "Acme", role: "Recruiter" },
  ]);
});

test("splits multiple addresses out of a Company Leads export row", () => {
  // Mirrors the columns produced by GET /api/companies/export
  const buf = sheetBuffer([
    {
      Company: "Acme Corp",
      Website: "acme.com",
      Domain: "acme.com",
      "HR / Recruiting Emails": "hr@acme.com; jobs@acme.com",
      "Other Emails": "info@acme.com",
      "HR Contacts": "Jane Doe (Recruiter); John Smith (HR Manager)",
    },
  ]);
  const out = parseSheet(buf);
  assert.equal(out.length, 3);
  assert.deepEqual(
    out.map((r) => r.email),
    ["hr@acme.com", "jobs@acme.com", "info@acme.com"]
  );
  for (const r of out) {
    assert.equal(r.company, "Acme Corp");
    assert.equal(r.name, "Jane Doe");
  }
});

test("dedupes an address that appears in both email columns and across rows", () => {
  const buf = sheetBuffer([
    {
      Company: "Acme Corp",
      "HR / Recruiting Emails": "hr@acme.com",
      "Other Emails": "hr@acme.com",
    },
    {
      Company: "Acme Corp (dup)",
      "HR / Recruiting Emails": "HR@ACME.com",
    },
  ]);
  const out = parseSheet(buf);
  assert.deepEqual(
    out.map((r) => r.email),
    ["hr@acme.com"]
  );
});

test("skips leads rows with no valid email at all", () => {
  const buf = sheetBuffer([
    { Company: "No Email Inc", "HR / Recruiting Emails": "", "Other Emails": "" },
  ]);
  assert.deepEqual(parseSheet(buf), []);
});
