# Daily Pulse

A zero-input personal dashboard. Open the app and your local weather, fresh news, and matching LinkedIn job listings are already there — the backend scrapes everything on a schedule, so the only thing you ever type is a one-time preference setup.

**Stack:** MongoDB · Express · React (Vite) · Node.js · Zustand · TailwindCSS v4 · Puppeteer · Cheerio · node-cron. No API keys anywhere.

## Features

- **Weather** — browser geolocation → Open-Meteo (free, keyless): current temperature, condition, and a 3-day forecast, with the city name resolved via free reverse geocoding.
- **News feed** — RSS scraped from BBC News, NDTV, TechCrunch, Reuters, The Hindu, Hacker News, and Economic Times every 30 minutes. Filter by category (tech / business / sports / world) and time range — all filtering happens in MongoDB, not the browser.
- **LinkedIn jobs** — Puppeteer scrapes LinkedIn's public job search for your keywords + location every 3 hours. Each card links straight to the posting.
- **Preferences** — a slide-in drawer for news categories and job keywords/location. Saved to localStorage; no login.
- **Dark mode** — full theme toggle, persisted, no flash on reload.

## Project structure

```
daily-pulse/
├── client/                  # React (Vite) app
│   └── src/
│       ├── components/      # all hand-built — no UI libraries
│       ├── store/           # Zustand stores (prefs persist to localStorage)
│       └── lib/             # fetch + time helpers
└── server/
    ├── models/              # Article, Job, JobSearch (Mongoose)
    ├── scrapers/            # news.scraper.js (cheerio+axios), jobs.scraper.js (Puppeteer)
    ├── cron/                # scheduler.js (node-cron)
    ├── routes/              # news, jobs, weather
    ├── utils/               # shared timeRange → date cutoff
    └── index.js
```

## Setup

Requirements: Node 18+, MongoDB (local install, Docker, or a free [Atlas](https://www.mongodb.com/atlas) cluster).

```bash
# 1. MongoDB — e.g. via Docker
docker run -d --name daily-pulse-mongo -p 27017:27017 mongo:7

# 2. Server
cd server
npm install                  # downloads Chromium for Puppeteer (~170 MB)
cp .env.example .env         # adjust MONGO_URI if needed
npm run dev                  # http://localhost:5000

# 3. Client (separate terminal)
cd client
npm install
npm run dev                  # http://localhost:5173 (proxies /api → :5000)
```

On boot the server immediately runs a news scrape, so the feed fills within seconds. Jobs appear after you save keywords in the preference drawer (first scrape takes ~30–60 s; the UI polls until it lands).

### Single-service production build

The server serves `client/dist` automatically when it exists:

```bash
cd client && npm run build
cd ../server && npm start    # whole app on http://localhost:5000
```

For separate hosting (e.g. client on Netlify/Vercel, server on Render/Railway), set `VITE_API_URL=https://your-server` when building the client. Note: the server needs a host that allows headless Chrome (Render and Railway work; serverless platforms don't).

## How the backend works

| What | Schedule | How |
|---|---|---|
| News | every 30 min (`*/30 * * * *`) + on boot | 19 RSS feeds fetched with axios, parsed with cheerio (XML mode), tagged with a category per feed, bulk-upserted on unique `url` |
| Jobs | every 3 h (`0 */3 * * *`) + on boot + on preference save | Puppeteer loads LinkedIn's public search, extracts cards, strips tracking params from URLs, bulk-upserts on unique `url` |

Both scrapers have overlap guards (a slow run is skipped, never doubled) and per-feed/per-search error isolation — one dead source never breaks the rest.

**Preference sync:** your preferences live in localStorage, but the cron scraper runs server-side, so saving the drawer also POSTs the job search to the server (stored in the `JobSearch` collection). v1 is single-user: the latest saved search replaces older ones.

## API

| Endpoint | Params | Notes |
|---|---|---|
| `GET /api/news` | `category` (comma-separated), `timeRange` (`24h`\|`3d`\|`7d`), `limit` | MongoDB-side filtering, sorted by `publishedAt` |
| `GET /api/jobs` | `keyword`, `location`, `timeRange`, `limit` | sorted by `postedAt` |
| `POST /api/jobs/preferences` | `{ keywords, location }` | registers the search + triggers an immediate scrape |
| `GET /api/weather` | `lat`, `lon` | Open-Meteo proxy + reverse-geocoded city, 10-min cache |
| `GET /api/health` | — | server + DB status |

## Environment

`server/.env.example`:

```
MONGO_URI=mongodb://127.0.0.1:27017/daily-pulse
```

That's the only variable. `PORT` defaults to 5000.

## Honest caveats

- **LinkedIn** has no public API for this and its ToS prohibit scraping; treat this as a personal-use tool. LinkedIn sometimes serves an auth wall to headless browsers — the scraper detects that, logs a warning, and retries on the next cron run rather than crashing. Selectors may need updating if LinkedIn changes its public markup.
- **Reuters** retired its public RSS feeds, so Reuters headlines come through Google News' RSS search scoped to `reuters.com` sections. Links route through a Google News redirect to the original article.
- **Free tiers sleep.** On Render's free plan the server sleeps after inactivity, which also pauses cron until the next request wakes it.
