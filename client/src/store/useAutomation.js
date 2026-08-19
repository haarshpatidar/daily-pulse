import { create } from "zustand";
import { getJSON, postJSON, patchJSON, del, postForm } from "../lib/api.js";

const EMPTY_STATS = { total: 0, pending: 0, sending: 0, sent: 0, failed: 0, skipped: 0 };

export const useAutomation = create((set, get) => ({
  stats: EMPTY_STATS,
  status: { running: false, sentThisRun: 0, startedAt: null, currentEmail: null },
  smtpCreds: null,
  smtpLoaded: false,
  resume: { exists: false },
  template: { subject: "", body: "" },
  recipients: [],
  recipientFilter: "all",
  recipientQuery: "",
  loading: true,
  error: null,

  // ---- polling (stats + automation status; cheap, drives the live "sending" UI) ----
  refresh: async () => {
    try {
      const [s, st] = await Promise.all([
        getJSON("/api/automation/stats"),
        getJSON("/api/automation/status"),
      ]);
      set({ stats: s.stats, status: st, loading: false, error: null });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  init: async () => {
    await Promise.all([
      get().refresh(),
      get().fetchSmtp(),
      get().fetchResume(),
      get().fetchTemplate(),
      get().fetchRecipients(),
    ]);
  },

  start: async () => {
    const r = await postJSON("/api/automation/start", {});
    await get().refresh();
    return r;
  },

  stop: async () => {
    const r = await postJSON("/api/automation/stop", {});
    await get().refresh();
    return r;
  },

  // ---- SMTP ----
  fetchSmtp: async () => {
    const r = await getJSON("/api/automation/smtp");
    set({ smtpCreds: r.creds, smtpLoaded: true });
  },

  saveSmtp: async (creds) => {
    const r = await postJSON("/api/automation/smtp", creds);
    await get().fetchSmtp();
    return r;
  },

  testSmtp: async () => postJSON("/api/automation/smtp/test", {}),

  deleteSmtp: async () => {
    await del("/api/automation/smtp");
    await get().fetchSmtp();
  },

  // ---- resume ----
  fetchResume: async () => {
    const r = await getJSON("/api/automation/upload/resume");
    set({ resume: r });
  },

  uploadResume: async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await postForm("/api/automation/upload/resume", fd);
    await get().fetchResume();
    return r;
  },

  // ---- template ----
  fetchTemplate: async () => {
    const r = await getJSON("/api/automation/template");
    set({ template: { subject: r.subject || "", body: r.body || "" } });
  },

  saveTemplate: async (subject, body) => {
    const r = await postJSON("/api/automation/template", { subject, body });
    set({ template: { subject, body } });
    return r;
  },

  sendTestEmail: async (to) => postJSON("/api/automation/test-email", { to }),

  // ---- recipients ----
  setRecipientFilter: (recipientFilter) => {
    set({ recipientFilter });
    get().fetchRecipients();
  },

  setRecipientQuery: (recipientQuery) => {
    set({ recipientQuery });
    get().fetchRecipients();
  },

  fetchRecipients: async () => {
    const { recipientFilter, recipientQuery } = get();
    const params = new URLSearchParams();
    if (recipientFilter !== "all") params.set("status", recipientFilter);
    if (recipientQuery) params.set("q", recipientQuery);
    const r = await getJSON(`/api/automation/recipients?${params}`);
    set({ recipients: r.recipients || [] });
  },

  uploadExcel: async (file, mode) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    const r = await postForm("/api/automation/upload/excel", fd);
    await Promise.all([get().fetchRecipients(), get().refresh()]);
    return r;
  },

  resetRecipient: async (id) => {
    await patchJSON("/api/automation/recipients", { id, action: "reset" });
    await Promise.all([get().fetchRecipients(), get().refresh()]);
  },

  skipRecipient: async (id) => {
    await patchJSON("/api/automation/recipients", { id, action: "skip" });
    await Promise.all([get().fetchRecipients(), get().refresh()]);
  },

  deleteRecipient: async (id) => {
    await del(`/api/automation/recipients?id=${id}`);
    await Promise.all([get().fetchRecipients(), get().refresh()]);
  },

  deleteAllRecipients: async () => {
    await del("/api/automation/recipients?all=true");
    await Promise.all([get().fetchRecipients(), get().refresh()]);
  },
}));
