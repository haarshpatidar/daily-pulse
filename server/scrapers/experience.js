// Pulls the "years of experience" requirement out of a job description.
//
// LinkedIn's logged-out search does expose an experience filter (f_E), but it
// leaks badly — a probe of the guest endpoint returned 20 of the same 30 jobs
// for "internship" and "executive" — and it also drops postings that state no
// level at all. So the scraper doesn't send it; the description text is the
// only honest source, and this is what reads it.

const WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
};

const NUM = `\\d{1,2}|${Object.keys(WORDS).join("|")}`;

// number ["-"/"to" number] ["+"] "years"/"yrs", with an optional lead-in.
// The number is guarded with a lookbehind rather than \b because postings run
// text together — "…continuous improvementQualifications3+ years" is real, and
// \b would never fire between "s" and "3".
const YEAR_RE = new RegExp(
  `(?:\\b(minimum|min|at\\s*least|atleast|over|more\\s+than|upwards\\s+of)\\b\\s*(?:of\\s+)?)?` +
    `(?<![\\d.])(${NUM})\\b` +
    `(?:(?:\\s*[-–—]\\s*|\\s+to\\s+|\\s+through\\s+)\\b(${NUM})\\b)?` +
    `\\s*(\\+)?\\s*(?:years?|yrs?\\.?)`,
  "gi"
);

// the mention has to actually be about the candidate's experience
const WANTED = /experien|\bexp\b|\bexp\./i;

// …and not about the company's age or history
const UNWANTED =
  /\bago\b|founded|established|in business|track record|over the past|over the last|anniversary|since\s+\d{4}|legacy|serving\s+(?:clients|customers)/i;

const EDUCATION = /education|schooling|degree|academic/i;

// "15 years of full time education" is a schooling requirement, not experience —
// but "5 years of experience or equivalent education" is a real one. They differ
// by whether the years attach to experience before education is ever mentioned.
function isEducationRequirement(textAfterMatch) {
  const trailing = textAfterMatch.slice(0, 40);
  const edu = EDUCATION.exec(trailing);
  return Boolean(edu) && !WANTED.test(trailing.slice(0, edu.index));
}

const MAX_MIN_YEARS = 20; // a requirement above this is a misread, not a job
const MAX_MAX_YEARS = 40;

const toNumber = (raw) => {
  if (raw == null) return NaN;
  const key = String(raw).toLowerCase();
  return key in WORDS ? WORDS[key] : Number(key);
};

/**
 * @param {string} text job description
 * @returns {{min: number, max: number|null, text: string}|null} null when the
 *   posting never states a requirement — callers must treat that as "unknown"
 *   and keep the job, never as a zero.
 */
export function extractExperience(text) {
  if (!text || typeof text !== "string") return null;
  const clean = text.replace(/\s+/g, " ");

  const candidates = [];
  YEAR_RE.lastIndex = 0;
  let m;
  while ((m = YEAR_RE.exec(clean)) !== null) {
    const [match, , first, second] = m;

    const context = clean.slice(
      Math.max(0, m.index - 60),
      m.index + match.length + 80
    );
    if (!WANTED.test(context) || UNWANTED.test(context)) continue;
    if (isEducationRequirement(clean.slice(m.index + match.length))) continue;

    let min = toNumber(first);
    let max = second === undefined ? null : toNumber(second);
    if (!Number.isFinite(min)) continue;
    if (max !== null && !Number.isFinite(max)) max = null;
    if (max !== null && max < min) [min, max] = [max, min]; // "8-3 years"

    if (min < 0 || min > MAX_MIN_YEARS) continue;
    if (max !== null && max > MAX_MAX_YEARS) max = null;

    candidates.push({ min, max, text: match.trim().slice(0, 80) });
  }

  if (candidates.length === 0) return null;
  // an explicit range is more informative than a bare "N years" mentioned earlier
  return candidates.find((c) => c.max !== null) || candidates[0];
}

/**
 * Mongo filter for "jobs that suit someone in this experience band".
 * A job qualifies when its range overlaps the requested one — and jobs that
 * never stated a requirement always qualify, so a vague posting is never
 * hidden from the feed.
 *
 * @returns {object|undefined} undefined when no bounds were requested
 */
export function experienceQuery(min, max) {
  const lo = Number.isFinite(min) ? min : null;
  const hi = Number.isFinite(max) ? max : null;
  if (lo === null && hi === null) return undefined;

  const overlaps = [];
  // the job must not demand more than the user's ceiling
  if (hi !== null) overlaps.push({ expMin: { $lte: hi } });
  // …and an upper-bounded job must still reach the user's floor
  if (lo !== null) overlaps.push({ $or: [{ expMax: null }, { expMax: { $gte: lo } }] });

  return { $or: [{ expMin: null }, { $and: overlaps }] };
}
