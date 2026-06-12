import { create } from "zustand";
import { getJSON, postJSON } from "../lib/api.js";
import { usePrefs } from "./usePrefs.js";

let pollTimer = null;

export const useJobs = create((set, get) => ({
  jobs: [],
  loading: true,
  error: null,
  timeRange: "7d",
  scraping: false, // a first scrape is running server-side

  setTimeRange: (timeRange) => {
    set({ timeRange });
    get().fetch();
  },

  clearFilters: () => {
    set({ timeRange: "7d" });
    get().fetch();
  },

  fetch: async ({ background = false } = {}) => {
    const { jobKeywords, jobLocation } = usePrefs.getState();
    if (!jobKeywords) {
      set({ jobs: [], loading: false });
      return;
    }

    if (!background) set({ loading: true, error: null });

    try {
      const params = new URLSearchParams({
        keyword: jobKeywords,
        timeRange: get().timeRange,
        limit: "500",
      });
      if (jobLocation) params.set("location", jobLocation);
      const data = await getJSON(`/api/jobs?${params}`);
      set({ jobs: data.jobs, loading: false, error: null });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // Push the saved keywords/location to the server (so cron tracks them),
  // then poll until the first scrape lands.
  syncPreferences: async () => {
    const { jobKeywords, jobLocation } = usePrefs.getState();
    if (!jobKeywords) return;

    try {
      await postJSON("/api/jobs/preferences", {
        keywords: jobKeywords,
        location: jobLocation,
      });
    } catch (err) {
      set({ error: err.message });
      return;
    }

    set({ scraping: true });
    if (pollTimer) clearInterval(pollTimer);
    let tries = 0;
    // a full paginated scrape can take ~1.5 min, so poll for up to ~3 min
    pollTimer = setInterval(async () => {
      tries += 1;
      await get().fetch({ background: true });
      if (get().jobs.length > 0 || tries >= 22) {
        clearInterval(pollTimer);
        pollTimer = null;
        set({ scraping: false });
      }
    }, 8000);
  },

  // On app load: if the user has keywords saved but the server has no jobs
  // for them (e.g. a fresh database), re-sync so cron picks them up again.
  init: async () => {
    await get().fetch();
    const { jobKeywords } = usePrefs.getState();
    if (jobKeywords && get().jobs.length === 0 && !get().error) {
      get().syncPreferences();
    }
  },
}));
