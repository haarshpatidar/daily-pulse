import { useMemo, useRef, useState } from "react";
import { useAutomation } from "../../store/useAutomation.js";
import { SearchIcon, RotateCcwIcon, TrashIcon } from "../icons.jsx";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "sending", label: "Sending" },
  { key: "sent", label: "Sent" },
  { key: "failed", label: "Failed" },
  { key: "skipped", label: "Skipped" },
];

const STATUS_CLASS = {
  pending: "status-muted",
  sending: "status-preparing",
  sent: "status-done",
  failed: "status-error",
  skipped: "status-warn",
};

export default function RecipientsTable() {
  const recipients = useAutomation((s) => s.recipients);
  const recipientFilter = useAutomation((s) => s.recipientFilter);
  const setRecipientFilter = useAutomation((s) => s.setRecipientFilter);
  const setRecipientQuery = useAutomation((s) => s.setRecipientQuery);
  const resetRecipient = useAutomation((s) => s.resetRecipient);
  const deleteRecipient = useAutomation((s) => s.deleteRecipient);
  const deleteAllRecipients = useAutomation((s) => s.deleteAllRecipients);

  const [q, setQ] = useState("");
  const debounceRef = useRef(null);
  const onSearch = (value) => {
    setQ(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setRecipientQuery(value), 200);
  };

  const counts = useMemo(() => {
    const c = {};
    for (const r of recipients) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [recipients]);

  async function removeRow(id) {
    if (!confirm("Delete this recipient?")) return;
    await deleteRecipient(id);
  }

  async function removeAll() {
    if (!confirm("Delete ALL recipients? This cannot be undone.")) return;
    await deleteAllRecipients();
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-line">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`pill ${recipientFilter === f.key ? "active" : ""}`}
              onClick={() => setRecipientFilter(f.key)}
            >
              {f.label}
              {f.key !== "all" && counts[f.key] !== undefined ? ` (${counts[f.key]})` : ""}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon />
          </span>
          <input
            className="filter-input pl-8 w-64"
            placeholder="Search email, company, role…"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <button className="apply-btn-ghost text-error" onClick={removeAll} title="Delete all">
          <TrashIcon />
          Clear all
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="text-muted">
            <tr>
              <th className="text-left font-medium px-4 py-2">Email</th>
              <th className="text-left font-medium px-4 py-2">Name</th>
              <th className="text-left font-medium px-4 py-2">Company</th>
              <th className="text-left font-medium px-4 py-2">Role</th>
              <th className="text-left font-medium px-4 py-2">Status</th>
              <th className="text-left font-medium px-4 py-2">Sent at</th>
              <th className="text-right font-medium px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {recipients.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted">
                  No recipients yet. Upload an Excel sheet above to begin.
                </td>
              </tr>
            )}
            {recipients.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{r.email}</td>
                <td className="px-4 py-2">{r.name || <span className="text-muted">—</span>}</td>
                <td className="px-4 py-2">{r.company || <span className="text-muted">—</span>}</td>
                <td className="px-4 py-2">{r.role || <span className="text-muted">—</span>}</td>
                <td className="px-4 py-2">
                  <span className={`status-badge ${STATUS_CLASS[r.status] || "status-muted"}`}>
                    {r.status}
                  </span>
                  {r.error && (
                    <span title={r.error} className="ml-2 text-[12px] text-error cursor-help">
                      ⚠
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted tabular-nums">
                  {r.sent_at ? new Date(`${r.sent_at}Z`).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button
                    className="icon-btn"
                    onClick={() => resetRecipient(r.id)}
                    title="Reset to pending"
                    aria-label={`Reset ${r.email} to pending`}
                  >
                    <RotateCcwIcon />
                  </button>
                  <button
                    className="icon-btn text-error"
                    onClick={() => removeRow(r.id)}
                    title="Delete"
                    aria-label={`Delete ${r.email}`}
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
