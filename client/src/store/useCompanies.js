import { create } from "zustand";
import { getJSON, postJSON, apiUrl } from "../lib/api.js";
import { usePrefs } from "./usePrefs.js";

let pollTimer = null;

const EMPTY_FILTERS = {
  q: "",
  hiring: false,
  hiringContract: false,
  hasHrEmail: false,
  minEmployees: "",
  maxEmployees: "",
  foundedAfter: "",
  minRating: "",
};

// Turn the filter state into a query string the API understands (only the
// fields the user actually set).
function filterParams(filters) {
  const p = new URLSearchParams({ limit: "1000" });
  if (filters.q) p.set("q", filters.q);
  if (filters.hiring) p.set("hiring", "true");
  if (filters.hiringContract) p.set("hiringContract", "true");
  if (filters.hasHrEmail) p.set("hasHrEmail", "true");
  if (filters.minEmployees) p.set("minEmployees", filters.minEmployees);
  if (filters.maxEmployees) p.set("maxEmployees", filters.maxEmployees);
  if (filters.foundedAfter) p.set("foundedAfter", filters.foundedAfter);
  if (filters.minRating) p.set("minRating", filters.minRating);
  return p;
}

export const useCompanies = create((set, get) => ({
  companies: [],
  emailCount: 0,
  hrEmailCount: 0,
  withHrEmail: 0,
  loading: true,
  error: null,
  scraping: false, // an enrichment run is in progress server-side
  filters: { ...EMPTY_FILTERS },

  setFilter: (key, value) => {
    set({ filters: { ...get().filters, [key]: value } });
    get().fetch();
  },

  clearFilters: () => {
    set({ filters: { ...EMPTY_FILTERS } });
    get().fetch();
  },

  fetch: async ({ background = false } = {}) => {
    if (!background) set({ loading: true, error: null });
    try {
      const params = filterParams(get().filters);
      const data = await getJSON(`/api/companies?${params}`);
      set({
        companies: data.companies,
        emailCount: data.emailCount,
        hrEmailCount: data.hrEmailCount,
        withHrEmail: data.withHrEmail,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // Push the lead search to the server (saves it + kicks off enrichment),
  // then poll until leads start landing. Enrichment is slower than the jobs
  // scrape (one HTTP crawl per company), so results stream in over a few mins.
  syncPreferences: async () => {
    const { leadCompanies, leadFromJobs } = usePrefs.getState();
    if (!leadCompanies.trim() && !leadFromJobs) return;

    try {
      await postJSON("/api/companies/preferences", {
        companies: leadCompanies,
        fromJobs: leadFromJobs,
      });
    } catch (err) {
      set({ error: err.message });
      return;
    }

    set({ scraping: true });
    if (pollTimer) clearInterval(pollTimer);
    let tries = 0;
    pollTimer = setInterval(async () => {
      tries += 1;
      await get().fetch({ background: true });
      // stop spinning once leads appear, or give up after ~5 minutes
      if (get().companies.length > 0 || tries >= 38) {
        clearInterval(pollTimer);
        pollTimer = null;
        set({ scraping: false });
      }
    }, 8000);
  },

  // Hand the browser the export endpoint with the current filters applied so
  // the downloaded .xlsx matches exactly what's on screen.
  exportExcel: () => {
    const params = filterParams(get().filters);
    params.delete("limit");
    window.open(apiUrl(`/api/companies/export?${params}`), "_blank");
  },

  // Just load whatever the server has enriched so far. Enrichment is only ever
  // started explicitly (saving lead settings) or by cron — never silently on
  // load, since "from job results" defaults on and would scan every company.
  init: async () => {
    await get().fetch();
  },
}));
