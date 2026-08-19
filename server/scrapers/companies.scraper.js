import axios from "axios";
import * as cheerio from "cheerio";
import Company from "../models/Company.js";
import CompanySearch from "../models/CompanySearch.js";
import Job from "../models/Job.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const REQUEST_TIMEOUT = 12000;
const PER_COMPANY_DELAY_MS = 1500; // politeness gap between companies
const MAX_PAGES_PER_SITE = 8; // homepage + a few contact/about/careers pages
const MAX_FETCH_ATTEMPTS = 16; // cap requests per site (most extra paths 404 fast)
const MAX_COMPANIES_PER_RUN = 120; // bound total runtime
const MAX_HTML_BYTES = 3_000_000; // skip absurdly large pages

// Common contact/about/careers paths probed directly — SPA homepages rarely
// link them in static HTML, but the pages themselves are usually server-rendered
// and carry the published emails (e.g. /contact.html, /careers).
const COMMON_PATHS = [
  "/contact", "/contact-us", "/contactus", "/contact.html", "/contact-us.html",
  "/about", "/about-us", "/about.html", "/company",
  "/careers", "/careers.html", "/jobs", "/team", "/people",
];

// Domains that are never a company's *own* site — skip them when resolving the
// official website (they're directories, socials or job boards).
const NON_OFFICIAL = [
  "linkedin.com", "facebook.com", "twitter.com", "x.com", "instagram.com",
  "youtube.com", "wikipedia.org", "glassdoor.", "ambitionbox.com", "crunchbase.com",
  "indeed.com", "naukri.com", "zaubacorp.com", "bloomberg.com", "tracxn.com",
  "wellfound.com", "angel.co", "duckduckgo.com", "google.com", "bing.com",
  "pinterest.com", "medium.com", "github.com", "reddit.com", "yelp.com",
];

// Pages worth fetching beyond the homepage, matched against link text/href.
const CONTACT_HINTS = /contact|about|career|jobs|join|team|people|hr|recruit|work-with/i;

// Local-part prefixes that mark an inbox as recruiting/people-facing.
const HR_PREFIXES = /^(hr|career|careers|job|jobs|recruit|recruiting|recruiter|recruitment|talent|hiring|people|joinus|join|work|cv|resume|apply|hello-careers)/i;
const GENERAL_PREFIXES = /^(info|contact|hello|hi|support|admin|office|mail|enquir|inquir|general|connect|reach|sales|hq|corporate)/i;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const CURRENT_YEAR = new Date().getFullYear();

let busy = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const nameKeyOf = (name) => name.trim().toLowerCase().replace(/\s+/g, " ");

async function fetchHtml(url) {
  const { data, headers } = await axios.get(url, {
    timeout: REQUEST_TIMEOUT,
    responseType: "text",
    maxContentLength: MAX_HTML_BYTES,
    maxRedirects: 5,
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9" },
    // company sites throw every status under the sun; let the caller decide
    validateStatus: (s) => s >= 200 && s < 400,
  });
  const type = headers["content-type"] || "";
  if (type && !/html|xml|text/.test(type)) return "";
  return typeof data === "string" ? data : "";
}

// Strip legal/industry suffixes so "Acme Technologies Pvt Ltd" → "acme".
const LEGAL_SUFFIX =
  /\b(inc|incorporated|llc|ltd|limited|pvt|private|plc|gmbh|sa|bv|ag|corp|corporation|co|company|technologies|technology|solutions|software|labs|systems|group|holdings|industries|services|consulting|global|international)\b/gi;

const TLDS = ["com", "io", "co", "ai", "in", "net", "org"];
const MAX_RESOLVE_PROBES = 16;
const RESOLVE_TIMEOUT = 7000;

const normToken = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Candidate domain slugs ranked best-first. `strict` variants (first word only)
// must be confirmed by the page title to avoid matching an unrelated domain.
function slugVariants(name) {
  const cleaned = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const noSuffix = cleaned.replace(LEGAL_SUFFIX, " ").replace(/\s+/g, " ").trim() || cleaned;
  const words = noSuffix.split(" ").filter(Boolean);

  const variants = [];
  const push = (slug, strict) => {
    if (slug.length >= 2 && slug.length <= 40 && !variants.some((v) => v.slug === slug)) {
      variants.push({ slug, strict });
    }
  };
  if (words.length) {
    push(words.join(""), false); // gitlab, freshworks
    if (words.length > 1) push(words.join("-"), false); // git-lab
    if (words.length > 1) push(words[0], true); // first word — needs title match
  }
  push(cleaned.replace(/\s+/g, ""), false); // keep suffix variant as last resort
  return variants;
}

async function probeDomain(host, nameNorm, slugNorm, strict) {
  let html;
  try {
    html = await axios
      .get(`https://${host}`, {
        timeout: RESOLVE_TIMEOUT,
        responseType: "text",
        maxRedirects: 5,
        maxContentLength: MAX_HTML_BYTES,
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9" },
        validateStatus: (s) => s >= 200 && s < 400,
      })
      .then((r) => (typeof r.data === "string" ? r.data : ""));
  } catch {
    return ""; // DNS failure / unreachable / blocked
  }
  if (!html) return "";

  const $ = cheerio.load(html);
  const title = normToken(
    `${$('meta[property="og:site_name"]').attr("content") || ""} ${$("title").first().text() || ""}`
  );
  const titleOk = nameNorm.length >= 3 && title.includes(nameNorm);
  const domainOk =
    !strict && slugNorm && nameNorm && (slugNorm.includes(nameNorm) || nameNorm.includes(slugNorm));
  return domainOk || titleOk ? `https://${host}` : "";
}

// DuckDuckGo's Instant Answer JSON API (not the bot-blocked HTML endpoint) —
// used as a fallback when a company's domain isn't guessable from its name.
async function resolveViaInstantAnswer(name) {
  try {
    const { data } = await axios.get("https://api.duckduckgo.com/", {
      params: { q: name, format: "json", no_html: 1, no_redirect: 1, t: "dailypulse" },
      timeout: RESOLVE_TIMEOUT,
      headers: { "User-Agent": USER_AGENT },
    });
    const urls = [data?.Results?.[0]?.FirstURL, data?.AbstractURL].filter(Boolean);
    for (const u of urls) {
      let host;
      try {
        host = new URL(u).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }
      if (NON_OFFICIAL.some((d) => host.includes(d))) continue; // skip wiki/socials
      return `https://${host}`;
    }
  } catch {
    /* IA unavailable — fine */
  }
  return "";
}

// Resolve a company's official website by probing likely domains built from its
// name, verifying the homepage actually belongs to the company.
async function resolveWebsite(name) {
  const nameNorm = normToken(name.replace(LEGAL_SUFFIX, ""));
  let probes = 0;
  for (const { slug, strict } of slugVariants(name)) {
    const slugNorm = normToken(slug);
    for (const tld of TLDS) {
      if (probes >= MAX_RESOLVE_PROBES) break;
      probes += 1;
      const hit = await probeDomain(`${slug}.${tld}`, nameNorm, slugNorm, strict);
      if (hit) return hit;
    }
  }
  return resolveViaInstantAnswer(name);
}

// Pull the homepage plus a handful of likely contact/about/careers pages.
async function crawlSite(website) {
  const visited = new Set();
  const htmls = [];
  let origin;
  try {
    origin = new URL(website).origin;
  } catch {
    return { htmls, origin: "" };
  }

  let home = "";
  try {
    // capture the post-redirect URL so a homepage that bounces to www. or a
    // different subdomain (e.g. gitlab.com → about.gitlab.com) sets the origin
    // we probe common paths against.
    const resp = await axios.get(website, {
      timeout: REQUEST_TIMEOUT,
      responseType: "text",
      maxContentLength: MAX_HTML_BYTES,
      maxRedirects: 5,
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9" },
      validateStatus: (s) => s >= 200 && s < 400,
    });
    home = typeof resp.data === "string" ? resp.data : "";
    const finalUrl = resp.request?.res?.responseUrl;
    if (finalUrl) {
      try {
        origin = new URL(finalUrl).origin;
      } catch { /* keep original origin */ }
    }
  } catch {
    home = "";
  }
  if (home) {
    visited.add(website.replace(/\/$/, ""));
    htmls.push({ url: website, html: home });
  }

  // Contact/about/careers links discovered on the homepage…
  const discovered = [];
  if (home) {
    const $ = cheerio.load(home);
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text();
      if (!CONTACT_HINTS.test(href) && !CONTACT_HINTS.test(text)) return;
      let abs;
      try {
        abs = new URL(href, origin).href.split("#")[0].replace(/\/$/, "");
      } catch {
        return;
      }
      if (abs.startsWith(origin) && !discovered.includes(abs)) discovered.push(abs);
    });
  }

  // …plus well-known paths probed directly (SPA homepages don't link them).
  const guessed = COMMON_PATHS.map((p) => `${origin}${p}`);
  const queue = [...guessed, ...discovered];

  let attempts = 0;
  for (const url of queue) {
    if (htmls.length >= MAX_PAGES_PER_SITE || attempts >= MAX_FETCH_ATTEMPTS) break;
    const norm = url.replace(/\/$/, "");
    if (visited.has(norm)) continue;
    visited.add(norm);
    attempts += 1;
    try {
      const html = await fetchHtml(url);
      if (html) htmls.push({ url, html });
    } catch {
      /* 404 / unreachable subpage — skip */
    }
  }

  return { htmls, origin };
}

function classifyEmail(address) {
  const local = address.split("@")[0];
  if (HR_PREFIXES.test(local)) return "hr";
  if (GENERAL_PREFIXES.test(local)) return "general";
  return "other";
}

const JUNK_EMAIL = /\.(png|jpe?g|gif|svg|webp|ico|css|js)$|^[0-9a-f]{16,}@|@(?:sentry|wixpress|example|your-?domain|domain|email|sentry\.io|2x)\b/i;

// Replace common "name [at] domain [dot] com" obfuscation so the regex catches it.
function deobfuscate(text) {
  return text
    .replace(/\s*(?:\[|\()\s*at\s*(?:\]|\))\s*/gi, "@")
    .replace(/\s*(?:\[|\()\s*dot\s*(?:\]|\))\s*/gi, ".");
}

function extractEmails(htmls) {
  const found = new Map(); // address -> { address, type, source }
  for (const { url, html } of htmls) {
    const $ = cheerio.load(html);

    // mailto: links are the most reliable signal
    $('a[href^="mailto:"]').each((_, el) => {
      const raw = ($(el).attr("href") || "").replace(/^mailto:/i, "").split("?")[0].trim();
      addEmail(found, raw, url);
    });

    // strip tags to whitespace first so adjacent text can never glue onto an
    // address (cheerio's .text() would turn "…@x.com</a>next" into one token),
    // then catch any address rendered in page text, incl. obfuscated forms.
    const stripped = html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    const text = deobfuscate(stripped);
    const matches = text.match(EMAIL_RE) || [];
    for (const m of matches) addEmail(found, m, url);
  }
  return [...found.values()];
}

function addEmail(map, raw, source) {
  const address = raw.toLowerCase().trim().replace(/[.,;:]+$/, "");
  if (!address || address.length > 100) return;
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(address)) return;
  if (JUNK_EMAIL.test(address)) return;
  if (map.has(address)) return;
  map.set(address, { address, type: classifyEmail(address), source });
}

// Walk a JSON-LD node tree collecting Organization-ish firmographics.
function readJsonLd(htmls) {
  const out = {};
  const want = (obj) => {
    const types = [].concat(obj["@type"] || []);
    return types.some((t) => /Organization|Corporation|LocalBusiness|Company/i.test(String(t)));
  };
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node["@graph"]) walk(node["@graph"]);
    if (want(node)) {
      if (!out.foundedYear && node.foundingDate) {
        const y = parseInt(String(node.foundingDate).slice(0, 4), 10);
        if (y >= 1800 && y <= CURRENT_YEAR) out.foundedYear = y;
      }
      if (!out.employeeCount && node.numberOfEmployees != null) {
        const v = node.numberOfEmployees;
        const n = parseInt(typeof v === "object" ? v.value ?? v.maxValue ?? v.minValue : v, 10);
        if (Number.isFinite(n) && n > 0) out.employeeCount = n;
      }
      if (!out.description && node.description) out.description = String(node.description).slice(0, 500);
      if (!out.location && node.address && typeof node.address === "object") {
        const a = node.address;
        out.location = [a.addressLocality, a.addressRegion, a.addressCountry]
          .filter(Boolean)
          .join(", ");
      }
      const ar = node.aggregateRating;
      if (ar && typeof ar === "object") {
        const rv = parseFloat(ar.ratingValue);
        if (Number.isFinite(rv)) out.rating = rv;
        const rc = parseInt(ar.reviewCount ?? ar.ratingCount, 10);
        if (Number.isFinite(rc)) out.reviewCount = rc;
      }
    }
    // recurse into nested objects regardless of type
    for (const k of Object.keys(node)) {
      if (k !== "@graph" && typeof node[k] === "object") walk(node[k]);
    }
  };

  for (const { html } of htmls) {
    const $ = cheerio.load(html);
    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).contents().text();
      if (!raw) return;
      try {
        walk(JSON.parse(raw));
      } catch {
        /* malformed JSON-LD — ignore */
      }
    });
  }
  return out;
}

// Regex fallbacks for detail JSON-LD didn't provide.
function regexMeta(htmls) {
  const out = {};
  const $home = htmls[0] ? cheerio.load(htmls[0].html) : null;
  if ($home) {
    out.description =
      $home('meta[name="description"]').attr("content") ||
      $home('meta[property="og:description"]').attr("content") ||
      "";
    out.description = (out.description || "").trim().slice(0, 500);
  }

  const text = htmls.map((h) => h.html).join(" ").replace(/<[^>]+>/g, " ");

  const foundedM =
    /(?:founded|established|est\.?|incorporated|since|inception)\b[^0-9]{0,18}((?:18|19|20)\d{2})/i.exec(text);
  if (foundedM) {
    const y = parseInt(foundedM[1], 10);
    if (y >= 1800 && y <= CURRENT_YEAR) out.foundedYear = y;
  }

  // headcount: ranges like "51-200 employees" or "over 5,000 employees"
  const rangeM = /(\d{1,3}(?:,\d{3})*|\d+)\s*(?:[-–to]+\s*(\d{1,3}(?:,\d{3})*|\d+))?\s*\+?\s*employees/i.exec(text);
  if (rangeM) {
    const lo = Number(rangeM[1].replace(/,/g, ""));
    const hi = rangeM[2] ? Number(rangeM[2].replace(/,/g, "")) : null;
    if (Number.isFinite(lo)) {
      out.employeeRange = hi ? `${lo}-${hi}` : `${lo}+`;
      out.employeeCount = hi || lo;
    }
  }

  const hqM = /headquarter(?:s|ed)?\s*(?:in|:)?\s*([A-Z][A-Za-z .,'-]{2,40})/.exec(text);
  if (hqM) out.location = hqM[1].trim().replace(/\s+/g, " ");

  return out;
}

// Best-effort named HR people from team/about pages. Strict on purpose: it
// pairs a real-looking person name with a full HR/recruiting title, and rejects
// anything that echoes the company name (which catches product names like
// "Zoho Recruit"). Often empty — that's preferable to noise.
const HR_TITLE_STRICT =
  /\b(HR (?:Manager|Executive|Lead|Head|Director|Business Partner|Generalist)|Human Resources?(?: Manager| Director| Lead| Head| Executive)?|Talent Acquisition(?: Manager| Specialist| Lead| Partner)?|Recruit(?:er|ment Manager|ment Lead|ment Specialist)|Head of (?:People|Talent|HR|Recruiting)|People Operations|VP(?: of)? People|Director of (?:People|HR|Talent)|Chief People Officer|CHRO)\b/i;
const NAME_STOPWORDS = new Set([
  "the", "our", "team", "inc", "ltd", "llc", "pvt", "company", "careers", "contact",
  "about", "people", "talent", "recruit", "human", "resources",
]);

function extractHrContacts(htmls, companyName) {
  const contacts = [];
  const seen = new Set();
  const cTokens = companyName.toLowerCase().match(/[a-z]{3,}/g) || [];

  for (const { html } of htmls) {
    const $ = cheerio.load(html);
    $("li, .team-member, .member, .person, .card, article, .profile, .employee, .staff").each((_, el) => {
      const block = $(el).text().replace(/\s+/g, " ").trim();
      if (block.length > 140) return;
      const titleM = HR_TITLE_STRICT.exec(block);
      if (!titleM) return;
      const nameM = /\b([A-Z][a-z]{1,}(?:\s+[A-Z][a-z.]{1,}){1,2})\b/.exec(block);
      if (!nameM) return;
      const name = nameM[1].trim();
      const tokens = name.toLowerCase().split(/\s+/);
      // reject product/company echoes and stopword "names"
      if (tokens.some((t) => NAME_STOPWORDS.has(t) || cTokens.includes(t))) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      contacts.push({ name, title: titleM[0] });
    });
  }
  return contacts.slice(0, 10);
}

// Enrich one company name into a full lead document and upsert it.
async function enrichCompany(name, keyword) {
  const nameKey = nameKeyOf(name);
  const lead = {
    name: name.trim(),
    nameKey,
    keyword,
    status: "failed",
    scrapedAt: new Date(),
    emails: [],
    hrContacts: [],
    hrNames: [],
  };

  try {
    const website = await resolveWebsite(name);
    if (website) {
      lead.website = website;
      try {
        lead.domain = new URL(website).hostname.replace(/^www\./, "");
      } catch { /* leave blank */ }

      const { htmls } = await crawlSite(website);
      if (htmls.length) {
        const emails = extractEmails(htmls);
        const meta = { ...regexMeta(htmls), ...readJsonLd(htmls) }; // JSON-LD wins
        const hrContacts = extractHrContacts(htmls, name);

        lead.emails = emails;
        lead.hrContacts = hrContacts;
        lead.hrNames = hrContacts.map((c) => c.name);
        lead.foundedYear = meta.foundedYear ?? null;
        lead.employeeCount = meta.employeeCount ?? null;
        lead.employeeRange = meta.employeeRange || "";
        lead.location = meta.location || "";
        lead.rating = meta.rating ?? null;
        lead.reviewCount = meta.reviewCount ?? null;
        lead.description = meta.description || "";
        lead.status = "enriched";
      }
    }
  } catch (err) {
    console.warn(`[companies] "${name}" enrich error: ${err.message}`);
  }

  // hiring signal from our own scraped Jobs — overall, and specifically for
  // contract/freelance roles (employmentType is tagged from the same detail
  // read the jobs scraper already does for experience).
  try {
    const companyFilter = { company: new RegExp(`^${escapeRegex(name.trim())}$`, "i") };
    const [jobCount, contractJobCount] = await Promise.all([
      Job.countDocuments(companyFilter),
      Job.countDocuments({ ...companyFilter, employmentType: "contract" }),
    ]);
    lead.jobCount = jobCount;
    lead.hiring = jobCount > 0;
    lead.contractJobCount = contractJobCount;
    lead.hiringContract = contractJobCount > 0;
  } catch { /* non-fatal */ }

  lead.emailCount = lead.emails.length;
  lead.hrEmailCount = lead.emails.filter((e) => e.type === "hr").length;

  await Company.updateOne({ nameKey }, { $set: lead }, { upsert: true });
  return lead;
}

// Build the de-duplicated list of company names to enrich for a search:
// explicit names + (optionally) every distinct company we've scraped jobs for.
async function collectCompanyNames(search) {
  const names = new Map(); // nameKey -> display name
  for (const n of search.companies || []) {
    const t = String(n).trim();
    if (t) names.set(nameKeyOf(t), t);
  }
  if (search.fromJobs) {
    const distinct = await Job.distinct("company");
    for (const c of distinct) {
      const t = String(c || "").trim();
      if (t && t.toLowerCase() !== "unknown") names.set(nameKeyOf(t), t);
    }
  }
  return [...names.values()].slice(0, MAX_COMPANIES_PER_RUN);
}

async function runSearch(search) {
  const names = await collectCompanyNames(search);
  if (names.length === 0) {
    console.log("[companies] no company names to enrich (add names or scrape jobs first)");
    return { companies: 0, enriched: 0, emails: 0 };
  }

  let enriched = 0;
  let emails = 0;
  for (const [i, name] of names.entries()) {
    try {
      const lead = await enrichCompany(name, search.keyword || "");
      if (lead.status === "enriched") enriched += 1;
      emails += lead.emailCount;
    } catch (err) {
      console.warn(`[companies] "${name}" failed: ${err.message}`);
    }
    if (i < names.length - 1) await sleep(PER_COMPANY_DELAY_MS);
  }

  await CompanySearch.updateOne({ _id: search._id }, { $set: { lastScrapedAt: new Date() } });
  console.log(
    `[companies] "${search.keyword || "leads"}" — ${names.length} companies, ${enriched} enriched, ${emails} emails`
  );
  return { companies: names.length, enriched, emails };
}

// Enrich every tracked company search (used by cron).
export async function scrapeAllCompanies() {
  if (busy) {
    console.log("[companies] previous run still going, skipping this round");
    return { skipped: true };
  }
  busy = true;
  try {
    const searches = await CompanySearch.find().lean();
    if (searches.length === 0) {
      console.log("[companies] no tracked company search yet — save lead preferences first");
      return { searches: 0 };
    }
    let totals = { companies: 0, enriched: 0, emails: 0 };
    for (const search of searches) {
      try {
        const r = await runSearch(search);
        totals.companies += r.companies || 0;
        totals.enriched += r.enriched || 0;
        totals.emails += r.emails || 0;
      } catch (err) {
        console.warn(`[companies] search failed: ${err.message}`);
      }
    }
    return { searches: searches.length, ...totals };
  } finally {
    busy = false;
  }
}

// Enrich a single saved search immediately (used when the user saves lead
// preferences, so the first leads appear without waiting for cron).
export async function scrapeCompaniesForSearch(searchId) {
  if (busy) return { skipped: true };
  busy = true;
  try {
    const search = await CompanySearch.findById(searchId).lean();
    if (!search) return { searches: 0 };
    return await runSearch(search);
  } finally {
    busy = false;
  }
}

// Exported for ad-hoc/standalone testing.
export { enrichCompany, resolveWebsite, extractEmails };
