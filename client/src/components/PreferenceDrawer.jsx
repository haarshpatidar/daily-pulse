import { useEffect, useState } from "react";
import { usePrefs, CATEGORIES } from "../store/usePrefs.js";
import { useUi } from "../store/useUi.js";
import { useNews } from "../store/useNews.js";
import { useJobs } from "../store/useJobs.js";
import { useCompanies } from "../store/useCompanies.js";
import { useFreelance } from "../store/useFreelance.js";
import { CloseIcon } from "./icons.jsx";

// years-of-experience bands; null means "no bound on this end"
const EXPERIENCE_PRESETS = [
  { id: "any", label: "Any", min: null, max: null },
  { id: "0-2", label: "0–2 yrs", min: 0, max: 2 },
  { id: "0-3", label: "0–3 yrs", min: 0, max: 3 },
  { id: "2-5", label: "2–5 yrs", min: 2, max: 5 },
  { id: "5+", label: "5+ yrs", min: 5, max: null },
];

// mirrors server/scrapers/employmentType.js's EMPLOYMENT_TYPES
const EMPLOYMENT_TYPE_OPTIONS = [
  { id: "contract", label: "Contract / Freelance" },
  { id: "full-time", label: "Full-time" },
  { id: "part-time", label: "Part-time" },
  { id: "temporary", label: "Temporary" },
  { id: "internship", label: "Internship" },
];

// null/undefined -> empty input; undefined shows up for preferences persisted
// before the experience filter existed
const asField = (value) => (value === null || value === undefined ? "" : String(value));

const asNumber = (raw) => {
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.trunc(n), 40) : null;
};

export default function PreferenceDrawer() {
  const open = useUi((s) => s.drawerOpen);
  const closeDrawer = useUi((s) => s.closeDrawer);

  const [selected, setSelected] = useState([]);
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [expMin, setExpMin] = useState("");
  const [expMax, setExpMax] = useState("");
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [leadCompanies, setLeadCompanies] = useState("");
  const [leadFromJobs, setLeadFromJobs] = useState(true);

  const activePreset = EXPERIENCE_PRESETS.find(
    (p) => p.min === asNumber(expMin) && p.max === asNumber(expMax)
  );

  const applyPreset = (preset) => {
    setExpMin(preset.min === null ? "" : String(preset.min));
    setExpMax(preset.max === null ? "" : String(preset.max));
  };

  // re-seed local form state from saved prefs every time the drawer opens
  useEffect(() => {
    if (open) {
      const prefs = usePrefs.getState();
      setSelected(prefs.categories);
      setKeywords(prefs.jobKeywords);
      setLocation(prefs.jobLocation);
      setExpMin(asField(prefs.jobExpMin));
      setExpMax(asField(prefs.jobExpMax));
      setEmploymentTypes(prefs.jobEmploymentTypes || []);
      setLeadCompanies(prefs.leadCompanies);
      setLeadFromJobs(prefs.leadFromJobs);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && closeDrawer();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDrawer]);

  const toggleCategory = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );

  const toggleEmploymentType = (id) =>
    setEmploymentTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );

  const canSave = selected.length > 0;

  const save = () => {
    const prefs = usePrefs.getState();
    const prevKeywords = prefs.jobKeywords;
    const prevLocation = prefs.jobLocation;
    const prevLeadCompanies = prefs.leadCompanies;
    const prevLeadFromJobs = prefs.leadFromJobs;
    const nextKeywords = keywords.trim();
    const nextLocation = location.trim();
    const nextLeadCompanies = leadCompanies.trim();

    // tolerate a back-to-front range rather than silently returning nothing
    let nextExpMin = asNumber(expMin);
    let nextExpMax = asNumber(expMax);
    if (nextExpMin !== null && nextExpMax !== null && nextExpMin > nextExpMax) {
      [nextExpMin, nextExpMax] = [nextExpMax, nextExpMin];
    }

    usePrefs.getState().savePreferences({
      categories: selected,
      jobKeywords: nextKeywords,
      jobLocation: nextLocation,
      jobExpMin: nextExpMin,
      jobExpMax: nextExpMax,
      jobEmploymentTypes: employmentTypes,
      leadCompanies: nextLeadCompanies,
      leadFromJobs,
    });

    useNews.getState().fetch();
    if (nextKeywords && (nextKeywords !== prevKeywords || nextLocation !== prevLocation)) {
      useJobs.getState().syncPreferences();
    }
    useJobs.getState().fetch();

    // re-run lead enrichment only when the lead search actually changed and
    // there's something to scan
    const leadChanged =
      nextLeadCompanies !== prevLeadCompanies || leadFromJobs !== prevLeadFromJobs;
    if (leadChanged && (nextLeadCompanies || leadFromJobs)) {
      useCompanies.getState().syncPreferences();
    }
    useCompanies.getState().fetch();
    useFreelance.getState().fetch();
    closeDrawer();
  };

  return (
    <>
      <div
        className={`drawer-overlay ${open ? "open" : ""}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <aside
        className={`drawer ${open ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Preferences"
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-[16px]">Preferences</h2>
          <button className="icon-btn" onClick={closeDrawer} aria-label="Close preferences">
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <section>
            <span className="source-label mb-4">News categories</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className={`pill ${selected.includes(c.id) ? "active" : ""}`}
                  onClick={() => toggleCategory(c.id)}
                  aria-pressed={selected.includes(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {!canSave && (
              <p className="text-[13px] text-muted mt-2">
                Pick at least one category.
              </p>
            )}
          </section>

          <section className="mt-8">
            <span className="source-label mb-4">Job search</span>
            <div className="flex flex-col gap-6 mt-4">
              <label className="block">
                <span className="text-[13px] text-muted">Keywords</span>
                <input
                  className="drawer-input mt-1"
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="e.g. react developer"
                  maxLength={100}
                />
              </label>
              <label className="block">
                <span className="text-[13px] text-muted">Location</span>
                <input
                  className="drawer-input mt-1"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Bengaluru, India or Remote"
                  maxLength={100}
                />
              </label>
            </div>

            <div className="mt-6">
              <span className="text-[13px] text-muted">Years of experience</span>
              <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="Experience range">
                {EXPERIENCE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className={`pill ${activePreset?.id === preset.id ? "active" : ""}`}
                    onClick={() => applyPreset(preset)}
                    aria-pressed={activePreset?.id === preset.id}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <label className="flex-1">
                  <span className="text-[13px] text-muted">Min</span>
                  <input
                    className="drawer-input mt-1"
                    type="number"
                    min="0"
                    max="40"
                    value={expMin}
                    onChange={(e) => setExpMin(e.target.value)}
                    placeholder="any"
                  />
                </label>
                <label className="flex-1">
                  <span className="text-[13px] text-muted">Max</span>
                  <input
                    className="drawer-input mt-1"
                    type="number"
                    min="0"
                    max="40"
                    value={expMax}
                    onChange={(e) => setExpMax(e.target.value)}
                    placeholder="any"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6">
              <span className="text-[13px] text-muted">Engagement type</span>
              <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="Engagement type">
                {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    className={`pill ${employmentTypes.includes(opt.id) ? "active" : ""}`}
                    onClick={() => toggleEmploymentType(opt.id)}
                    aria-pressed={employmentTypes.includes(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[13px] text-muted mt-4">
              Listings refresh from LinkedIn every 3 hours. Jobs that don’t state an
              experience requirement, or haven’t been read for engagement type yet,
              are always shown.
            </p>
          </section>

          <section className="mt-8">
            <span className="source-label mb-4">Company leads</span>
            <div className="flex flex-col gap-4 mt-4">
              <label className="block">
                <span className="text-[13px] text-muted">Company names (one per line)</span>
                <textarea
                  className="drawer-input mt-1 resize-none"
                  rows={4}
                  value={leadCompanies}
                  onChange={(e) => setLeadCompanies(e.target.value)}
                  placeholder={"Acme Corp\nGlobex\nStark Industries"}
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={leadFromJobs}
                  onChange={(e) => setLeadFromJobs(e.target.checked)}
                />
                <span className="text-[13px]">Also scan companies from my job results</span>
              </label>
            </div>
            <p className="text-[13px] text-muted mt-4">
              We collect only publicly published role emails (hr@, careers@, info@…) and visible
              company details from each company's own website. Refreshes every 6 hours.
            </p>
          </section>
        </div>

        <footer className="p-6 border-t border-line">
          <button className="save-btn" onClick={save} disabled={!canSave}>
            Save preferences
          </button>
        </footer>
      </aside>
    </>
  );
}
