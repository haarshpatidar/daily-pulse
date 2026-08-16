// Run with: node --test server/scrapers/
import test from "node:test";
import assert from "node:assert/strict";
import { extractExperience, experienceQuery } from "./experience.js";

const yrs = (text) => {
  const hit = extractExperience(text);
  return hit ? [hit.min, hit.max] : null;
};

test("reads an explicit range", () => {
  assert.deepEqual(yrs("3 to 8 years of solid hands-on experience"), [3, 8]);
  assert.deepEqual(yrs("5-8 years experience required"), [5, 8]);
  assert.deepEqual(yrs("3-5 years of hands-on experience"), [3, 5]);
  assert.deepEqual(yrs("8 to 10 years of experience"), [8, 10]);
  assert.deepEqual(yrs("Experience: 0-1 year"), [0, 1]);
  assert.deepEqual(yrs("2–4 years of experience"), [2, 4]); // en dash
});

test("reads an open-ended minimum", () => {
  assert.deepEqual(yrs("3+ years of experience with React"), [3, null]);
  assert.deepEqual(yrs("minimum 5 years of experience"), [5, null]);
  assert.deepEqual(yrs("at least 3 years of relevant experience"), [3, null]);
  assert.deepEqual(yrs("Experience of 4 years or more"), [4, null]);
  assert.deepEqual(yrs("6 yrs exp"), [6, null]);
});

test("reads spelled-out numbers", () => {
  assert.deepEqual(yrs("three years of experience in frontend"), [3, null]);
  assert.deepEqual(yrs("two to five years of experience"), [2, 5]);
});

test("ignores year mentions that are not a requirement", () => {
  // the false positive found on a live posting: company blurb, not a requirement
  assert.equal(extractExperience("A leader with over 25 years in the industry"), null);
  assert.equal(extractExperience("We were founded 30 years ago"), null);
  assert.equal(extractExperience("Revenue grew over the past 3 years"), null);
  assert.equal(extractExperience("Join our team of 500 engineers"), null);
  assert.equal(extractExperience(""), null);
  assert.equal(extractExperience(null), null);
});

test("reads a requirement glued to the preceding heading", () => {
  // real posting: "…continuous improvementQualifications3+ years of experience"
  assert.deepEqual(yrs("QualificationsRequired3+ years of experience developing apps"), [
    3,
    null,
  ]);
});

test("ignores an education requirement stated in years", () => {
  // real posting: "Education - 15 years of full time education"
  assert.equal(extractExperience("Education - 15 years of full time education"), null);
  // …but a nearby mention of education must not kill a real requirement
  assert.deepEqual(yrs("5 years of experience or equivalent education"), [5, null]);
});

test("rejects implausible requirements", () => {
  assert.equal(extractExperience("40 years of experience required"), null);
});

test("prefers a range over a bare minimum found earlier", () => {
  const hit = extractExperience(
    "Candidates need 2 years experience. Specifically 4-6 years of experience in React."
  );
  assert.deepEqual([hit.min, hit.max], [4, 6]);
});

test("keeps the matched snippet for display", () => {
  const hit = extractExperience("We want 3-5 years of experience here");
  assert.match(hit.text, /3-5 years/);
  assert.ok(hit.text.length <= 80);
});

test("normalises a reversed range", () => {
  assert.deepEqual(yrs("8-3 years of experience"), [3, 8]);
});

test("experienceQuery always lets through jobs with no stated experience", () => {
  const q = experienceQuery(0, 3);
  assert.ok(q.$or.some((c) => c.expMin === null));
});

test("experienceQuery is undefined when no bounds are set", () => {
  assert.equal(experienceQuery(null, null), undefined);
});

test("experienceQuery with an open-ended max omits the upper bound", () => {
  const q = experienceQuery(5, null);
  const range = q.$or.find((c) => c.$and);
  assert.ok(!JSON.stringify(range).includes("$lte"));
});
