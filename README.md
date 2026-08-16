# Daily Pulse

A zero-input personal dashboard. Open the app and your local weather, fresh news, LinkedIn job listings, and assisted job application tools are already there — the backend scrapes everything on a schedule, so the only thing you ever type is a one-time preference setup.

**Stack:** MongoDB · Express · React 19 (Vite 6) · Node.js 18+ · Zustand · TailwindCSS v4 · Puppeteer · Cheerio · node-cron

---

## Features

- **Weather** — browser geolocation → Open-Meteo (free, keyless): current temperature, condition, and a 3-day forecast with city name via free reverse-geocoding.
- **News feed** — RSS scraped from BBC News, NDTV, TechCrunch, Reuters, The Hindu, Hacker News, and Economic Times every 30 minutes. Filter by category (tech / business / sports / world) and time range. All filtering happens in MongoDB, not the browser.
- **LinkedIn jobs** — scrapes LinkedIn's public job search (plain HTTP + Cheerio, no browser) for your keywords + location every 3 hours. Each card links directly to the posting.
- **Experience filter** — each posting's detail page is read for the years of experience it asks for, so you can limit the feed to a band (e.g. 0–3 years). Postings that never state a requirement are always shown rather than guessed at.
- **Assisted apply** — auto-fill job applications in a visible browser window: upload your resume, manage your apply profile, and track submitted applications.
- **Company enrichment** — scrape and track company lead data tied to job postings.
- **Preferences** — a slide-in drawer for news categories and job keywords/location/experience range. Persisted to localStorage; no login required.
- **Dark mode** — full theme toggle, persisted across reloads.
- **Pagination** — for both news and job feeds.

---

## Project Structure

```
daily-pulse/
├── client/                  # React 19 (Vite 6) frontend
│   ├── src/
│   │   ├── components/      # All hand-built — no UI libraries
│   │   ├── store/           # Zustand stores (prefs persist to localStorage)
│   │   └── lib/             # Fetch helpers and time utilities
│   ├── .env.example
│   └── vite.config.js
└── server/                  # Express backend
    ├── models/              # Mongoose schemas
    ├── routes/              # Express route handlers
    ├── scrapers/            # news.scraper.js, jobs.scraper.js (both cheerio+axios),
    │                        # experience.js (years-of-experience parser)
    ├── cron/                # scheduler.js (node-cron)
    ├── utils/               # Shared utilities (timeRange, etc.)
    ├── uploads/             # Resume uploads (git-ignored)
    ├── .apply-sessions/     # Browser session data (git-ignored)
    ├── .env.example
    └── index.js
```

---

## Prerequisites

| Requirement | Minimum version | Notes |
|---|---|---|
| Node.js | 18+ | v20 LTS or v22+ recommended |
| npm | 9+ | Bundled with Node.js |
| MongoDB | 6+ | Local install, Docker, or free Atlas cluster |
| Git | any | For cloning |

---

## Setup — Step by Step

### 1. Clone the repository

```bash
git clone https://github.com/your-username/daily-pulse.git
cd daily-pulse
```

### 2. Start MongoDB

**Option A — Docker (recommended, no local install needed):**

```bash
docker run -d \
  --name daily-pulse-mongo \
  -p 27017:27017 \
  mongo:7
```

**Option B — Local MongoDB install:**

Make sure `mongod` is running. The default connection (`mongodb://127.0.0.1:27017`) will work with no changes.

**Option C — MongoDB Atlas (cloud, free M0 tier):**

Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas), copy the connection string, and set it as `MONGO_URI` in `server/.env` (step 4).

### 3. Install dependencies

Run these two commands — they are independent, so you can open two terminals or run them sequentially:

```bash
# Terminal 1 — Backend
cd server
npm install
# Note: Puppeteer downloads Chromium (~170 MB) on first install
```

```bash
# Terminal 2 — Frontend
cd client
npm install
```

### 4. Configure environment variables

**Server:**

```bash
cd server
cp .env.example .env
```

Open `server/.env` and adjust as needed (see [Environment Variables](#environment-variables) below).

**Client (optional — only needed for production or non-default API URL):**

```bash
cd client
cp .env.example .env
```

### 5. Start the development servers

You need **two terminals** running simultaneously.

**Terminal 1 — Backend (port 5000):**

```bash
cd server
npm run dev
```

**Terminal 2 — Frontend (port 5173):**

```bash
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

The Vite dev server proxies all `/api/*` requests to `http://localhost:5000` automatically — no CORS setup needed during development.

### 6. First-run data population

- **Weather** — allow location access in the browser; data loads immediately.
- **News** — the server runs a scrape on boot; the feed fills within seconds.
- **Jobs** — open the preferences drawer (gear icon), enter job keywords, location and an optional experience range, and save. Listings appear within about half a minute; the UI polls until data arrives. Experience tags fill in behind them. After that, jobs refresh every 3 hours automatically.
  Changing only the experience range re-filters instantly — it's applied by the API, so nothing is re-scraped.

---

## Environment Variables

### `server/.env`

| Variable | Default | Required | Description |
|---|---|---|---|
| `MONGO_URI` | `mongodb://127.0.0.1:27017/daily-pulse` | Yes | MongoDB connection string |
| `PORT` | `5000` | No | Express server port |
| `APPLY_HEADLESS` | `false` | No | Set to `true` to run Puppeteer in headless mode (no visible browser). Leave `false` for assisted apply — you review and submit in the visible window. |
| `APPLY_LOGIN_TIMEOUT_MS` | `180000` | No | Milliseconds to wait for you to log in to a job platform before the assistant times out (default: 3 minutes). |

### `client/.env`

| Variable | Default | Required | Description |
|---|---|---|---|
| `VITE_API_URL` | _(same origin)_ | No | API base URL. Only set this for production deployments where the client and server are on different domains (e.g. `https://api.yourdomain.com`). Leave unset in development. |

---

## Available Scripts

### Server (`cd server`)

| Command | Description |
|---|---|
| `npm run dev` | Start server with nodemon (auto-restarts on file changes) |
| `npm start` | Start server without hot-reload (production) |

### Client (`cd client`)

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server at http://localhost:5173 |
| `npm run build` | Build production bundle → `client/dist/` |
| `npm run preview` | Preview the production build locally |

---

## Production Build

### Option A — Single service (server serves the built client)

The server automatically serves `client/dist/` when it exists.

```bash
# 1. Build the frontend
cd client
npm run build

# 2. Start the server — serves everything on port 5000
cd ../server
npm start
```

Visit [http://localhost:5000](http://localhost:5000).

### Option B — Separate hosting (client on CDN, server standalone)

Build the client with the server's public URL:

```bash
cd client
VITE_API_URL=https://your-server.com npm run build
```

Then deploy `client/dist/` to Netlify, Vercel, or any static host, and deploy `server/` to a platform that supports headless Chrome (Render, Railway, or a VPS). Serverless platforms (AWS Lambda, Vercel Functions) do **not** support Puppeteer.

---

## API Reference

| Endpoint | Method | Params | Description |
|---|---|---|---|
| `/api/news` | GET | `category` (comma-sep), `timeRange` (`24h`\|`3d`\|`7d`), `limit` (max 120) | Filtered, sorted news articles |
| `/api/jobs` | GET | `keyword`, `location`, `timeRange`, `expMin`, `expMax`, `limit` (max 500) | Filtered, sorted job listings |
| `/api/jobs/preferences` | POST | `{ keywords, location }` | Save job search prefs + trigger immediate scrape |
| `/api/weather` | GET | `lat`, `lon` | Current weather + 3-day forecast (10-min cache) |
| `/api/apply/*` | GET/POST | — | Resume upload, profile management, application tracking |
| `/api/companies/*` | GET/POST | — | Company lead search and enrichment |
| `/api/health` | GET | — | Server and DB status |

---

## How the Backend Works

### Scheduled scrapers

| Data | Schedule | Mechanism |
|---|---|---|
| News | Every 30 min + on boot | 19 RSS feeds via axios + cheerio (XML), bulk-upserted on unique `url` |
| Jobs | Every 3 h + on boot + on preference save | HTTP → LinkedIn public search, strips tracking params, bulk-upserted on unique `url`. Listings are saved first, then detail pages are read for experience on a per-run budget — leftovers are picked up next run |
| Companies | Every 6 h + on boot | Company lead enrichment from job data |

All scrapers have **overlap guards** (a slow run is skipped, never doubled) and **per-feed error isolation** (one dead source never breaks the rest).

### Data retention

Both `Article` and `Job` documents have a **TTL index** that auto-deletes records after 30 days — no manual cleanup needed.

### Preference sync

Preferences live in localStorage, but job scraping runs server-side. Saving the drawer POSTs your job search to the server (`JobSearch` collection) which triggers an immediate scrape in addition to the 3-hour cron.

---

## Troubleshooting

**MongoDB connection refused:**
```bash
# Check if MongoDB is running (Docker)
docker ps | grep daily-pulse-mongo

# Start it if stopped
docker start daily-pulse-mongo
```

**Puppeteer/Chromium error on Linux:**
```bash
# Install missing system libraries
sudo apt-get install -y \
  libnspr4 libnss3 libasound2 libatk-bridge2.0-0 \
  libgtk-3-0 libgbm-dev
```

**Jobs not appearing:**
- Check the server console for LinkedIn auth-wall warnings — LinkedIn sometimes blocks headless browsers.
- The scraper detects this, logs a warning, and retries on the next 3-hour cron cycle.
- Ensure you have saved keywords in the preferences drawer.

**Port already in use:**
```bash
# Change the port in server/.env
PORT=5001
```

---

## Honest Caveats

- **LinkedIn** has no public API for this use case and its ToS prohibits scraping. Treat this as a personal-use tool. The scraper uses only public search pages — no login, no private data.
- **Reuters** retired its public RSS feeds; Reuters headlines come through Google News RSS scoped to `reuters.com`. Links route via a Google News redirect to the original article.
- **Free tiers sleep.** On Render's free plan the server sleeps after inactivity, which pauses cron jobs until the next request wakes it.
- **Atlas free tier** — the M0 cluster provides 512 MB of storage. TTL indexes keep data trimmed automatically.
