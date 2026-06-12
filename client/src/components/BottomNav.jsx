import { useUi } from "../store/useUi.js";
import { HomeIcon, NewsIcon, BriefcaseIcon } from "./icons.jsx";

const TABS = [
  { id: "dashboard", label: "Home", Icon: HomeIcon },
  { id: "news", label: "News", Icon: NewsIcon },
  { id: "jobs", label: "Jobs", Icon: BriefcaseIcon },
];

export default function BottomNav() {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`bottom-nav-item ${view === id ? "active" : ""}`}
          onClick={() => setView(id)}
          aria-current={view === id ? "page" : undefined}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
