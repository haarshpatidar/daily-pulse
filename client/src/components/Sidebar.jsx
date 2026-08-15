import { useUi } from "../store/useUi.js";
import { HomeIcon, NewsIcon, BriefcaseIcon, MailIcon } from "./icons.jsx";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", Icon: HomeIcon },
  { id: "news", label: "News", Icon: NewsIcon },
  { id: "jobs", label: "Jobs", Icon: BriefcaseIcon },
  { id: "leads", label: "Leads", Icon: MailIcon },
  // Assisted apply disabled 2026-08-16 — re-add with SendIcon to restore.
  // { id: "apply", label: "Apply", Icon: SendIcon },
];

export default function Sidebar() {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-logo">
        <span className="logo-mark" aria-hidden="true" />
        <span className="logo-text">Daily Pulse</span>
      </div>

      <nav className="flex flex-col gap-2">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`sidebar-item ${view === id ? "active" : ""}`}
            onClick={() => setView(id)}
            aria-current={view === id ? "page" : undefined}
          >
            <Icon />
            <span className="sidebar-label">{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
