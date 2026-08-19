import { useEffect } from "react";
import Sidebar from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import BottomNav from "./components/BottomNav.jsx";
import WeatherWidget from "./components/WeatherWidget.jsx";
import NewsFeed from "./components/NewsFeed.jsx";
import JobsFeed from "./components/JobsFeed.jsx";
import CompaniesFeed from "./components/CompaniesFeed.jsx";
import FreelanceFeed from "./components/FreelanceFeed.jsx";
import AutomationView from "./components/AutomationView.jsx";
// Assisted apply disabled 2026-08-16 — see server/index.js for why.
// import ApplyView from "./components/ApplyView.jsx";
import PreferenceDrawer from "./components/PreferenceDrawer.jsx";
import { usePrefs } from "./store/usePrefs.js";
import { useUi } from "./store/useUi.js";
import { useNews } from "./store/useNews.js";
import { useJobs } from "./store/useJobs.js";
import { useCompanies } from "./store/useCompanies.js";
import { useFreelance } from "./store/useFreelance.js";
// import { useApply } from "./store/useApply.js";
import { useWeather } from "./store/useWeather.js";

const REFRESH_INTERVAL = 5 * 60 * 1000;

export default function App() {
  const view = useUi((s) => s.view);
  const theme = usePrefs((s) => s.theme);
  const onboarded = usePrefs((s) => s.onboarded);
  const openDrawer = useUi((s) => s.openDrawer);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    useWeather.getState().fetch();
    useNews.getState().fetch();
    useJobs.getState().init();
    useCompanies.getState().init();
    useFreelance.getState().init();
    // useApply.getState().init();

    const id = setInterval(() => {
      useNews.getState().fetch({ background: true });
      useJobs.getState().fetch({ background: true });
      useCompanies.getState().fetch({ background: true });
      useFreelance.getState().fetch({ background: true });
    }, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, []);

  // first visit: open the one-time preference setup
  useEffect(() => {
    if (!onboarded) openDrawer();
  }, [onboarded, openDrawer]);

  return (
    <div className="min-h-screen">
      <Sidebar />
      <BottomNav />

      <div className="app-main">
        <TopBar />
        <main className="content">
          {view === "dashboard" && (
            <>
              <WeatherWidget />
              <NewsFeed limit={6} compact />
              <JobsFeed limit={4} compact />
              <CompaniesFeed limit={3} compact />
            </>
          )}
          {view === "news" && <NewsFeed />}
          {view === "jobs" && <JobsFeed />}
          {view === "freelance" && <FreelanceFeed />}
          {view === "leads" && <CompaniesFeed />}
          {view === "automation" && <AutomationView />}
          {/* {view === "apply" && <ApplyView />} */}
        </main>
      </div>

      <PreferenceDrawer />
    </div>
  );
}
