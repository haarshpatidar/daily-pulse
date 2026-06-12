import { create } from "zustand";

export const useUi = create((set) => ({
  view: "dashboard", // dashboard | news | jobs
  drawerOpen: false,
  setView: (view) => set({ view }),
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
}));
