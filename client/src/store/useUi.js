import { create } from "zustand";

export const useUi = create((set) => ({
  view: "dashboard", // dashboard | news | jobs | freelance | leads | automation  ("apply" disabled 2026-08-16)
  drawerOpen: false,
  setView: (view) => set({ view }),
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
}));
