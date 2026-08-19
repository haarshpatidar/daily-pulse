// Run with: node --test server/scrapers/
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEmploymentType,
  detectEmploymentTypeFromText,
  employmentTypeQuery,
} from "./employmentType.js";

test("normalizes LinkedIn's own criteria labels", () => {
  assert.equal(normalizeEmploymentType("Full-time"), "full-time");
  assert.equal(normalizeEmploymentType("Contract"), "contract");
  assert.equal(normalizeEmploymentType("Part-time"), "part-time");
  assert.equal(normalizeEmploymentType("Temporary"), "temporary");
  assert.equal(normalizeEmploymentType("Internship"), "internship");
  assert.equal(normalizeEmploymentType(""), "");
  assert.equal(normalizeEmploymentType("Other"), "other");
  assert.equal(normalizeEmploymentType("Something LinkedIn never actually sends"), "");
});

test("detects explicit contract/freelance mentions", () => {
  assert.equal(detectEmploymentTypeFromText("6-month contract role, extendable"), "contract");
  assert.equal(detectEmploymentTypeFromText("Looking for a freelancer to build a landing page"), "contract");
  assert.equal(detectEmploymentTypeFromText("This is a C2C engagement only"), "contract");
  assert.equal(detectEmploymentTypeFromText("Paid on a 1099 basis"), "contract");
  assert.equal(detectEmploymentTypeFromText("Engagement is SOW-based for Q1"), "contract");
});

test("detects temporary and internship separately from contract", () => {
  assert.equal(detectEmploymentTypeFromText("This is a temporary 3-month cover role"), "temporary");
  assert.equal(detectEmploymentTypeFromText("Summer internship for CS students"), "internship");
});

test("ignores unrelated uses of the same words", () => {
  assert.equal(detectEmploymentTypeFromText("We handle contract manufacturing for OEMs"), "");
  assert.equal(detectEmploymentTypeFromText("Advise clients on a government contract dispute"), "");
  assert.equal(detectEmploymentTypeFromText("Background in contract law preferred"), "");
});

test("ignores negated mentions", () => {
  assert.equal(detectEmploymentTypeFromText("This is not a contract position"), "");
  assert.equal(detectEmploymentTypeFromText("No freelancers, please — full-time only"), "");
});

test("does not false-positive on words that merely start the same way", () => {
  assert.equal(detectEmploymentTypeFromText("Familiarity with templates and template engines"), "");
  assert.equal(detectEmploymentTypeFromText("Monitor room temperature and humidity"), "");
  assert.equal(detectEmploymentTypeFromText("Strong international and internal stakeholder skills"), "");
});

test("returns empty for no text", () => {
  assert.equal(detectEmploymentTypeFromText(""), "");
  assert.equal(detectEmploymentTypeFromText(null), "");
});

test("employmentTypeQuery always lets through untagged jobs, including ones missing the field entirely", () => {
  const q = employmentTypeQuery(["contract"]);
  // null in $in matches both an explicit null AND a document where the field
  // is absent — every job scraped before this field existed relies on that.
  assert.ok(q.employmentType.$in.includes(""));
  assert.ok(q.employmentType.$in.includes(null));
  assert.ok(q.employmentType.$in.includes("contract"));
});

test("employmentTypeQuery is undefined when no types are requested", () => {
  assert.equal(employmentTypeQuery([]), undefined);
  assert.equal(employmentTypeQuery(undefined), undefined);
});

test("employmentTypeQuery drops unknown type values", () => {
  const q = employmentTypeQuery(["contract", "bogus"]);
  assert.ok(!q.employmentType.$in.includes("bogus"));
  assert.ok(q.employmentType.$in.includes("contract"));
});
