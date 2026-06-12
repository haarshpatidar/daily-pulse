import { usePrefs } from "../store/usePrefs.js";
import { useUi } from "../store/useUi.js";
import { useWeather } from "../store/useWeather.js";
import { formatTodayLong } from "../lib/time.js";
import { SunIcon, MoonIcon, SettingsIcon, MapPinIcon } from "./icons.jsx";

export default function TopBar() {
  const theme = usePrefs((s) => s.theme);
  const toggleTheme = usePrefs((s) => s.toggleTheme);
  const openDrawer = useUi((s) => s.openDrawer);
  const city = useWeather((s) => s.data?.city);

  return (
    <header className="topbar">
      <div className="flex items-center gap-4 min-w-0">
        <span className="text-[14px] font-medium whitespace-nowrap">
          {formatTodayLong()}
        </span>
        {city && (
          <span className="flex items-center gap-1 text-[13px] text-muted min-w-0">
            <MapPinIcon />
            <span className="truncate">{city}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          className="icon-btn"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        >
          {theme === "light" ? <MoonIcon /> : <SunIcon />}
        </button>
        <button className="icon-btn" onClick={openDrawer} aria-label="Open preferences">
          <SettingsIcon />
        </button>
      </div>
    </header>
  );
}
