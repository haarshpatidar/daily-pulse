import { useWeather } from "../store/useWeather.js";
import { dayLabel } from "../lib/time.js";
import { SkeletonWeather } from "./Skeleton.jsx";

export default function WeatherWidget() {
  const { data, loading, error, fetch } = useWeather();

  if (loading) return <SkeletonWeather />;

  if (error || !data) {
    const message =
      error === "denied"
        ? "Location access is blocked — allow it in your browser to see local weather."
        : "Couldn't load the weather right now.";
    return (
      <section className="card card-enter">
        <p className="text-[14px] text-muted">{message}</p>
        <button
          className="text-[13px] text-accent mt-2 hover:underline"
          onClick={() => fetch()}
        >
          Try again
        </button>
      </section>
    );
  }

  const { current, daily } = data;

  return (
    <section className="card card-enter weather-card" aria-label="Weather">
      <div>
        <div className="flex items-center gap-4">
          <span className="weather-temp">{Math.round(current.temp)}°</span>
          <span className="text-[24px] leading-none" aria-hidden="true">
            {current.icon}
          </span>
        </div>
        <p className="text-[14px] font-medium mt-2">{current.label}</p>
        <p className="text-[13px] text-muted">
          Feels like {Math.round(current.feelsLike)}° · {current.humidity}% humidity ·{" "}
          {Math.round(current.windSpeed)} km/h wind
        </p>
      </div>

      <div className="forecast-strip" aria-label="3-day forecast">
        {daily.map((day, i) => (
          <div key={day.date} className="forecast-day">
            <span className="text-[13px] text-muted">{dayLabel(day.date, i)}</span>
            <span className="text-[20px]" aria-hidden="true">
              {day.icon}
            </span>
            <span className="text-[13px]">
              <span className="font-medium">{Math.round(day.max)}°</span>{" "}
              <span className="text-muted">{Math.round(day.min)}°</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
