import { useEffect, useState } from "react";
import { usePrefs, CATEGORIES } from "../store/usePrefs.js";
import { useUi } from "../store/useUi.js";
import { useNews } from "../store/useNews.js";
import { useJobs } from "../store/useJobs.js";
import { CloseIcon } from "./icons.jsx";

export default function PreferenceDrawer() {
  const open = useUi((s) => s.drawerOpen);
  const closeDrawer = useUi((s) => s.closeDrawer);

  const [selected, setSelected] = useState([]);
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");

  // re-seed local form state from saved prefs every time the drawer opens
  useEffect(() => {
    if (open) {
      const prefs = usePrefs.getState();
      setSelected(prefs.categories);
      setKeywords(prefs.jobKeywords);
      setLocation(prefs.jobLocation);
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

  const canSave = selected.length > 0;

  const save = () => {
    const prevKeywords = usePrefs.getState().jobKeywords;
    const prevLocation = usePrefs.getState().jobLocation;
    const nextKeywords = keywords.trim();
    const nextLocation = location.trim();

    usePrefs.getState().savePreferences({
      categories: selected,
      jobKeywords: nextKeywords,
      jobLocation: nextLocation,
    });

    useNews.getState().fetch();
    if (nextKeywords && (nextKeywords !== prevKeywords || nextLocation !== prevLocation)) {
      useJobs.getState().syncPreferences();
    }
    useJobs.getState().fetch();
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
            <p className="text-[13px] text-muted mt-4">
              Listings refresh from LinkedIn every 3 hours.
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
