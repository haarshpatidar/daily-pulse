import { create } from "zustand";
import { persist } from "zustand/middleware";

export const CATEGORIES = [
  { id: "tech", label: "Tech" },
  { id: "business", label: "Business" },
  { id: "sports", label: "Sports" },
  { id: "world", label: "World" },
];

export const usePrefs = create(
  persist(
    (set) => ({
      theme: "light",
      categories: ["tech", "business", "sports", "world"],
      jobKeywords: "",
      jobLocation: "",
      // years-of-experience band the feed should show; null = no bound.
      // jobExpMax null with a min set means "N+ years".
      jobExpMin: null,
      jobExpMax: null,
      // company-lead search: names the user typed + whether to also scan
      // companies pulled from their scraped job results
      leadCompanies: "",
      leadFromJobs: true,
      onboarded: false,

      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),

      savePreferences: ({
        categories,
        jobKeywords,
        jobLocation,
        jobExpMin,
        jobExpMax,
        leadCompanies,
        leadFromJobs,
      }) =>
        set({
          categories,
          jobKeywords,
          jobLocation,
          jobExpMin,
          jobExpMax,
          leadCompanies,
          leadFromJobs,
          onboarded: true,
        }),
    }),
    { name: "daily-pulse-prefs" }
  )
);
