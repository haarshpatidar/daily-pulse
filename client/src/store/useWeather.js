import { create } from "zustand";
import { getJSON } from "../lib/api.js";

export const useWeather = create((set) => ({
  data: null,
  loading: true,
  error: null, // "denied" | "unavailable" | message

  fetch: () => {
    if (!("geolocation" in navigator)) {
      set({ error: "unavailable", loading: false });
      return;
    }

    set({ loading: true, error: null });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const data = await getJSON(
            `/api/weather?lat=${latitude.toFixed(4)}&lon=${longitude.toFixed(4)}`
          );
          set({ data, loading: false, error: null });
        } catch (err) {
          set({ error: err.message, loading: false });
        }
      },
      (err) => {
        set({
          error: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable",
          loading: false,
        });
      },
      { timeout: 10000, maximumAge: 10 * 60 * 1000 }
    );
  },
}));
