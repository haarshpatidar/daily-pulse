// Classifies a job posting's engagement type (full-time / contract / etc).
//
// LinkedIn's own detail page already states this as a job-criteria item
// ("Employment type: Contract") — the same page the scraper reads for
// seniority/experience — so that's the primary, authoritative source: it's
// the employer's own selection, not a guess. Free-text keyword matching below
// is only a fallback for postings where LinkedIn omits the criteria item.

export const EMPLOYMENT_TYPES = [
  "full-time",
  "part-time",
  "contract",
  "temporary",
  "internship",
  "volunteer",
  "other",
];

const CANONICAL = {
  fulltime: "full-time",
  parttime: "part-time",
  contract: "contract",
  temporary: "temporary",
  internship: "internship",
  volunteer: "volunteer",
  other: "other",
};

// LinkedIn's own criteria label -> canonical value.
export function normalizeEmploymentType(raw) {
  const key = String(raw || "").toLowerCase().replace(/[^a-z]/g, "");
  return CANONICAL[key] || "";
}

// Word-boundary matches only, each guarded against a short list of unrelated
// phrases that use the same word without describing the role's engagement
// type ("contract manufacturing", "government contract"), and against a
// preceding negation ("no contract", "not a freelance role" — tolerating a
// short filler article so "not a contract" still counts as negated).
const NEGATED_BEFORE = /\b(no|not|without|non)\b(?:\s+(?:a|an|the))?[\s-]*$/i;

const RULES = [
  {
    type: "contract",
    hint: /\b(contract|contractor|contractors|freelance|freelancer|freelancers|c2c|corp[\s-]to[\s-]corp|1099|fixed[\s-]term|sow[\s-]based|statement of work)\b/gi,
    unrelated: /\b(contract manufacturing|government contract|contract law|social contract|smart contract)\b/i,
  },
  {
    type: "temporary",
    hint: /\btemp(?:orary)?\b/gi,
    unrelated: null,
  },
  {
    type: "internship",
    hint: /\bintern(?:ship)?\b/gi,
    unrelated: null,
  },
];

/**
 * @param {string} text job title and/or description
 * @returns {string} a value from EMPLOYMENT_TYPES, or "" when nothing matched
 */
export function detectEmploymentTypeFromText(text) {
  if (!text || typeof text !== "string") return "";
  const clean = text.replace(/\s+/g, " ");

  for (const { type, hint, unrelated } of RULES) {
    if (unrelated?.test(clean)) continue;
    hint.lastIndex = 0;
    let m;
    while ((m = hint.exec(clean)) !== null) {
      const before = clean.slice(Math.max(0, m.index - 12), m.index);
      if (NEGATED_BEFORE.test(before)) continue;
      return type;
    }
  }
  return "";
}

/**
 * Mongo filter for "jobs whose engagement type is one of these". Jobs never
 * tagged yet always pass — same rule the experience filter uses, since the
 * tag comes from the same detail-page read that hasn't necessarily run yet,
 * not a stated absence of a type. That includes jobs scraped before this
 * field existed at all: they have no employmentType key in the stored
 * document, not even "" — and in Mongo, null inside $in matches a missing
 * field as well as an explicit null, which `{employmentType: ""}` would not.
 *
 * @returns {object|undefined} undefined when no types were requested
 */
export function employmentTypeQuery(types) {
  const list = (types || []).filter((t) => EMPLOYMENT_TYPES.includes(t));
  if (list.length === 0) return undefined;
  return { employmentType: { $in: [...list, "", null] } };
}
