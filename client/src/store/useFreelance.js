import { create } from "zustand";
import { getJSON } from "../lib/api.js";
import { usePrefs } from "./usePrefs.js";

// A focused, always-contract-filtered view over the same scraped data the
// Jobs/Leads views use. Deliberately its own store rather than reading
// useJobs/useCompanies: those are filtered by whatever engagement type the
// user picked in Preferences (which may not be "contract" at all), and this
// section needs to show contract work regardless of that setting.
export const useFreelance = create((set, get) => ({
  jobs: [],
  companies: [],
  loading: true,
  error: null,

  fetch: async ({ background = false } = {}) => {
    if (!background) set({ loading: true, error: null });
    try {
      const { jobKeywords, jobLocation } = usePrefs.getState();

      const jobsPromise = (async () => {
        if (!jobKeywords) return { jobs: [] };
        const params = new URLSearchParams({
          keyword: jobKeywords,
          employmentType: "contract",
          limit: "500",
        });
        if (jobLocation) params.set("location", jobLocation);
        return getJSON(`/api/jobs?${params}`);
      })();

      const companiesPromise = getJSON(
        `/api/companies?${new URLSearchParams({ hiringContract: "true", limit: "1000" })}`
      );

      const [jobsData, companiesData] = await Promise.all([jobsPromise, companiesPromise]);
      set({
        jobs: jobsData.jobs,
        companies: companiesData.companies,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  init: async () => {
    await get().fetch();
  },
}));
