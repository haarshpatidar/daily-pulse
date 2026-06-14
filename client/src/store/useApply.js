import { create } from "zustand";
import { getJSON, putJSON, patchJSON, postJSON, postForm, del } from "../lib/api.js";

// statuses that mean "still working" — while any application is in one of these
// we keep polling so the tracker reflects the headful browser's progress
const ACTIVE = new Set(["preparing"]);

let pollTimer = null;

export const useApply = create((set, get) => ({
  profile: null,
  applications: [],
  platforms: [],
  loading: true,
  saving: false,
  error: null,
  busy: false, // an apply action is driving the browser server-side

  init: async () => {
    await Promise.all([get().loadProfile(), get().loadApplications(), get().loadPlatforms()]);
    set({ loading: false });
  },

  loadProfile: async () => {
    try {
      const { profile } = await getJSON("/api/apply/profile");
      set({ profile, error: null });
    } catch (err) {
      set({ error: err.message });
    }
  },

  loadPlatforms: async () => {
    try {
      const { platforms } = await getJSON("/api/apply/platforms");
      set({ platforms });
    } catch {
      /* non-fatal */
    }
  },

  loadApplications: async ({ background = false } = {}) => {
    if (!background) set({ error: null });
    try {
      const { applications, busy } = await getJSON("/api/apply");
      set({ applications, busy });
      // keep polling while anything is mid-prepare
      if (applications.some((a) => ACTIVE.has(a.status)) || busy) get().startPolling();
    } catch (err) {
      if (!background) set({ error: err.message });
    }
  },

  saveProfile: async (fields) => {
    set({ saving: true, error: null });
    try {
      const { profile } = await putJSON("/api/apply/profile", fields);
      set({ profile, saving: false });
      return true;
    } catch (err) {
      set({ error: err.message, saving: false });
      return false;
    }
  },

  uploadResume: async (file) => {
    set({ error: null });
    const fd = new FormData();
    fd.append("resume", file);
    try {
      await postForm("/api/apply/resume", fd);
      await get().loadProfile();
      return true;
    } catch (err) {
      set({ error: err.message });
      return false;
    }
  },

  // queue a scraped job for applying; returns the created/existing application
  queue: async (job) => {
    set({ error: null });
    try {
      const { application } = await postJSON("/api/apply/queue", {
        title: job.title,
        company: job.company,
        location: job.location,
        applyUrl: job.url,
        sourceJobUrl: job.url,
        jobRef: job._id || null,
      });
      await get().loadApplications({ background: true });
      return application;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  prepare: async (id) => {
    set({ error: null });
    try {
      await postJSON(`/api/apply/${id}/prepare`, {});
      await get().loadApplications({ background: true });
      get().startPolling();
      return true;
    } catch (err) {
      set({ error: err.message });
      return false;
    }
  },

  updateStatus: async (id, status, note) => {
    try {
      const body = {};
      if (status) body.status = status;
      if (note != null) body.note = note;
      await patchJSON(`/api/apply/${id}`, body);
      await get().loadApplications({ background: true });
      return true;
    } catch (err) {
      set({ error: err.message });
      return false;
    }
  },

  remove: async (id) => {
    try {
      await del(`/api/apply/${id}`);
      set((s) => ({ applications: s.applications.filter((a) => a._id !== id) }));
    } catch (err) {
      set({ error: err.message });
    }
  },

  login: async (platform) => {
    set({ error: null });
    try {
      await postJSON(`/api/apply/platforms/${platform}/login`, {});
      return true;
    } catch (err) {
      set({ error: err.message });
      return false;
    }
  },

  // poll the tracker every few seconds while a prepare is in flight, then stop.
  // The cap is just a runaway guard — polling halts the instant nothing is busy.
  // It must outlast a prepare that's parked waiting for the user to sign in in
  // the live window (LOGIN_WAIT_MS, ~3 min) plus the autofill that follows.
  startPolling: () => {
    if (pollTimer) return;
    let ticks = 0;
    pollTimer = setInterval(async () => {
      ticks += 1;
      await get().loadApplications({ background: true });
      const stillBusy = get().busy || get().applications.some((a) => ACTIVE.has(a.status));
      if (!stillBusy || ticks >= 100) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }, 3000);
  },
}));
