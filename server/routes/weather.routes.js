import { Router } from "express";
import axios from "axios";

const router = Router();

// WMO weather interpretation codes → human label + clean unicode glyph
const WMO_CODES = {
  0: { label: "Clear sky", icon: "☀" },
  1: { label: "Mostly clear", icon: "🌤" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁" },
  45: { label: "Fog", icon: "🌫" },
  48: { label: "Rime fog", icon: "🌫" },
  51: { label: "Light drizzle", icon: "🌦" },
  53: { label: "Drizzle", icon: "🌦" },
  55: { label: "Heavy drizzle", icon: "🌧" },
  56: { label: "Freezing drizzle", icon: "🌧" },
  57: { label: "Freezing drizzle", icon: "🌧" },
  61: { label: "Light rain", icon: "🌧" },
  63: { label: "Rain", icon: "🌧" },
  65: { label: "Heavy rain", icon: "🌧" },
  66: { label: "Freezing rain", icon: "🌧" },
  67: { label: "Freezing rain", icon: "🌧" },
  71: { label: "Light snow", icon: "❄" },
  73: { label: "Snow", icon: "❄" },
  75: { label: "Heavy snow", icon: "❄" },
  77: { label: "Snow grains", icon: "❄" },
  80: { label: "Light showers", icon: "🌦" },
  81: { label: "Showers", icon: "🌧" },
  82: { label: "Heavy showers", icon: "🌧" },
  85: { label: "Snow showers", icon: "❄" },
  86: { label: "Snow showers", icon: "❄" },
  95: { label: "Thunderstorm", icon: "⛈" },
  96: { label: "Thunderstorm, hail", icon: "⛈" },
  99: { label: "Thunderstorm, hail", icon: "⛈" },
};

const describe = (code) => WMO_CODES[code] || { label: "—", icon: "☁" };

// Open-Meteo allows generous free usage, but a short cache keeps us polite
// and makes repeat loads instant.
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

// GET /api/weather?lat=12.97&lon=77.59
router.get("/", async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ error: "valid lat and lon query params are required" });
  }

  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return res.json(hit.data);
  }

  try {
    const [meteo, geo] = await Promise.all([
      axios.get("https://api.open-meteo.com/v1/forecast", {
        timeout: 10000,
        params: {
          latitude: lat,
          longitude: lon,
          current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
          daily: "weather_code,temperature_2m_max,temperature_2m_min",
          timezone: "auto",
          forecast_days: 3,
        },
      }),
      // free reverse geocoding, no API key — city name for the top bar
      axios
        .get("https://api.bigdatacloud.net/data/reverse-geocode-client", {
          timeout: 10000,
          params: { latitude: lat, longitude: lon, localityLanguage: "en" },
        })
        .catch(() => null),
    ]);

    const { current, daily } = meteo.data;
    const currentDesc = describe(current.weather_code);

    const data = {
      city: geo?.data?.city || geo?.data?.locality || "",
      current: {
        temp: current.temperature_2m,
        feelsLike: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        code: current.weather_code,
        label: currentDesc.label,
        icon: currentDesc.icon,
      },
      daily: daily.time.map((date, i) => {
        const desc = describe(daily.weather_code[i]);
        return {
          date,
          max: daily.temperature_2m_max[i],
          min: daily.temperature_2m_min[i],
          label: desc.label,
          icon: desc.icon,
        };
      }),
    };

    cache.set(cacheKey, { ts: Date.now(), data });
    res.json(data);
  } catch (err) {
    console.error("[api/weather]", err.message);
    res.status(502).json({ error: "Failed to fetch weather" });
  }
});

export default router;
