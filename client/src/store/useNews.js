import { create } from "zustand";
import { getJSON } from "../lib/api.js";
import { usePrefs } from "./usePrefs.js";

export const useNews = create((set, get) => ({
  articles: [],
  loading: true,
  error: null,
  category: "all",
  timeRange: "24h",

  setCategory: (category) => {
    set({ category });
    get().fetch();
  },

  setTimeRange: (timeRange) => {
    set({ timeRange });
    get().fetch();
  },

  clearFilters: () => {
    set({ category: "all", timeRange: "7d" });
    get().fetch();
  },

  // background fetches (auto-refresh) keep the current list on screen
  // instead of flashing skeletons.
  fetch: async ({ background = false } = {}) => {
    const { category, timeRange } = get();
    const prefCategories = usePrefs.getState().categories;
    const cat = category === "all" ? prefCategories.join(",") : category;

    if (!background) set({ loading: true, error: null });

    try {
      const params = new URLSearchParams({ timeRange });
      if (cat) params.set("category", cat);
      const data = await getJSON(`/api/news?${params}`);
      set({ articles: data.articles, loading: false, error: null });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },
}));
