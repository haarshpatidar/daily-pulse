import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Each platform gets its own Chrome profile dir so its login cookies persist
// across runs — the user signs in once per site, in the real browser window.
const SESSIONS_ROOT = path.resolve(__dirname, "../.apply-sessions");

// Assisted apply is meant to run with a visible window the user reviews and
// submits in. Set APPLY_HEADLESS=true only for automated testing of the engine
// (no display / CI) — there's no human to submit, so it won't actually apply.
const HEADLESS = process.env.APPLY_HEADLESS === "true";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-blink-features=AutomationControlled",
  "--window-size=1366,900",
];

// One live browser per platform, kept open so sessions persist and the user can
// interact with the window between actions.
const browsers = new Map(); // platform -> Browser

// Only one prepare/login may drive a browser at a time. Mirrors the `busy`
// overlap guard the scrapers use, so concurrent triggers don't fight over tabs.
let busy = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function isBusy() {
  return busy;
}

// Run `fn` under the single-flight lock. Returns { skipped: true } if another
// apply action is already in flight rather than queueing or racing.
export async function withLock(fn) {
  if (busy) return { skipped: true };
  busy = true;
  try {
    return await fn();
  } finally {
    busy = false;
  }
}

export async function getBrowser(platform) {
  const existing = browsers.get(platform);
  if (existing && existing.connected) return existing;

  const userDataDir = path.join(SESSIONS_ROOT, platform);
  const browser = await puppeteer.launch({
    headless: HEADLESS,
    userDataDir,
    defaultViewport: null, // fill the real window in headful mode
    args: LAUNCH_ARGS,
  });
  browsers.set(platform, browser);
  browser.on("disconnected", () => {
    if (browsers.get(platform) === browser) browsers.delete(platform);
  });
  return browser;
}

// Reuse the browser's first usable tab (so the user keeps one window) or open one.
export async function getPage(browser) {
  const pages = await browser.pages();
  const page =
    pages.find((p) => !/^(devtools|chrome):\/\//.test(p.url())) || (await browser.newPage());
  await page.setUserAgent(USER_AGENT);
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
  try {
    await page.bringToFront();
  } catch {
    /* headless / detached — fine */
  }
  return page;
}

// Heuristic login check, strongest signal first:
//   1. A visible login/auth wall  -> definitely NOT logged in.
//   2. The platform's auth cookie  -> definitely logged in. This is the reliable
//      one: the cookie is set the moment you sign in and persists in the profile,
//      so it doesn't suffer the false negatives of waiting for lazy-loaded UI
//      (e.g. LinkedIn's nav avatar) to paint.
//   3. The in-page logged-in marker -> fallback for sites without a known cookie.
//   4. No selectors at all (off-platform) -> optimistically assume usable.
export async function isLoggedIn(page, config) {
  if (config.loginWallSelector && (await page.$(config.loginWallSelector))) return false;

  if (config.authCookie) {
    try {
      const host = config.hostnames?.[0];
      const cookies = host ? await page.cookies(`https://www.${host}`) : await page.cookies();
      if (cookies.some((c) => c.name === config.authCookie && c.value)) return true;
    } catch {
      /* CDP hiccup mid-navigation — fall through to the marker check */
    }
  }

  if (config.loggedInSelector) return !!(await page.$(config.loggedInSelector));
  return true;
}

// Poll until the user has signed in inside the live window, or `timeoutMs`
// elapses. Lets the apply flow open the login page in the SAME window it will
// fill the form in, wait for the human to authenticate, then carry on — no
// separate "log in, come back, retry" round trip.
export async function waitForLogin(page, config, { timeoutMs = 180000, intervalMs = 1500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await isLoggedIn(page, config)) return true;
    } catch {
      /* page is navigating (the login submit) — try again next tick */
    }
    await sleep(intervalMs);
  }
  return false;
}

export async function closeBrowser(platform) {
  const b = browsers.get(platform);
  if (b) {
    browsers.delete(platform);
    try {
      await b.close();
    } catch {
      /* already gone */
    }
  }
}

export async function closeAll() {
  await Promise.all([...browsers.keys()].map(closeBrowser));
}

export { sleep };
