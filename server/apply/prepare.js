import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Application from "../models/Application.js";
import ApplyProfile from "../models/ApplyProfile.js";
import { detectPlatform, getPlatformConfig } from "./platforms.js";
import { getBrowser, getPage, isLoggedIn, waitForLogin, withLock, sleep } from "./session.js";
import { autofill, buildProfileValues } from "./autofill.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");
const SHOTS_DIR = path.join(UPLOADS_DIR, "screenshots");

// How long to hold the apply window open waiting for the user to sign in inside
// it before giving up. Generous — a human may need to handle a 2FA prompt.
const LOGIN_WAIT_MS = Number(process.env.APPLY_LOGIN_TIMEOUT_MS) || 180000;

// Load the singleton profile and resolve the resume's absolute path (if the file
// still exists on disk). Returns null if no profile has been saved yet.
async function loadProfile() {
  const profile = await ApplyProfile.findOne({ singleton: "me" }).lean();
  if (!profile) return null;
  let resumeAbsPath = "";
  const stored = profile.resumeFile?.storedName;
  if (stored) {
    const p = path.join(UPLOADS_DIR, stored);
    if (fs.existsSync(p)) resumeAbsPath = p;
  }
  return { values: buildProfileValues(profile), resumeAbsPath };
}

// Click the platform's apply/Easy-Apply trigger to open the form, if one exists
// and is present. No-op (and harmless) when the page is itself the form.
async function openApplyForm(page, config) {
  for (const sel of config.applyTriggers || []) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await sleep(2500); // let the modal / next page settle
        return true;
      }
    } catch {
      /* selector invalid or detached — try the next */
    }
  }
  return false;
}

// Open a visible window at a platform's login page so the user can sign in once.
// The session cookies persist in that platform's userDataDir for future runs.
export async function openLogin(platform) {
  return withLock(async () => {
    const config = getPlatformConfig(platform);
    const browser = await getBrowser(platform);
    const page = await getPage(browser);
    const url = config.loginUrl || (config.hostnames[0] ? `https://www.${config.hostnames[0]}` : "");
    if (url) await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    return { ok: true, loggedIn: await isLoggedIn(page, config) };
  });
}

// Check whether we currently hold a logged-in session for a platform, without
// disturbing any in-progress work. Used to render login status in the UI.
export async function checkLogin(platform) {
  return withLock(async () => {
    const config = getPlatformConfig(platform);
    if (!config.loginUrl && !config.hostnames.length) return { loggedIn: true };
    const browser = await getBrowser(platform);
    const page = await getPage(browser);
    const probe = config.loginUrl || `https://www.${config.hostnames[0]}`;
    await page.goto(probe, { waitUntil: "domcontentloaded", timeout: 45000 });
    return { loggedIn: await isLoggedIn(page, config) };
  });
}

// Prepare one queued application: open the apply page in the visible browser,
// pre-fill it from the profile, attach the resume, screenshot it, and leave it
// for the user to review and submit. Never submits. Status transitions:
//   queued -> preparing -> (needs_login | ready_for_review | failed)
export async function prepareApplication(appId) {
  return withLock(async () => {
    const app = await Application.findById(appId);
    if (!app) return { error: "Application not found" };

    const profile = await loadProfile();
    if (!profile) {
      await Application.updateOne(
        { _id: appId },
        { $set: { status: "failed", error: "Save your apply profile first" } }
      );
      return { status: "failed", error: "no profile" };
    }

    await Application.updateOne({ _id: appId }, { $set: { status: "preparing", error: "" } });

    try {
      const platform = app.platform || detectPlatform(app.applyUrl);
      const config = getPlatformConfig(platform);
      const browser = await getBrowser(platform);
      const page = await getPage(browser);

      await page.goto(app.applyUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      await sleep(1800);

      if (!(await isLoggedIn(page, config))) {
        // Sign in inside THIS window, then continue automatically — no separate
        // login step. Park on the platform's login page (the apply page itself if
        // we don't know one) and wait for the user to authenticate right here.
        await Application.updateOne({ _id: appId }, { $set: { status: "needs_login", error: "" } });
        const loginTarget = config.loginUrl || app.applyUrl;
        await page
          .goto(loginTarget, { waitUntil: "domcontentloaded", timeout: 45000 })
          .catch(() => {});
        try {
          await page.bringToFront();
        } catch {
          /* headless */
        }

        const signedIn = await waitForLogin(page, config, { timeoutMs: LOGIN_WAIT_MS });
        if (!signedIn) {
          await Application.updateOne(
            { _id: appId },
            {
              $set: {
                status: "needs_login",
                error: "Timed out waiting for sign-in — click Prepare to try again",
              },
            }
          );
          return { status: "needs_login" };
        }

        // Authenticated now — head back to the apply page and carry on.
        await Application.updateOne({ _id: appId }, { $set: { status: "preparing" } });
        await page.goto(app.applyUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await sleep(1800);
      }

      await openApplyForm(page, config);
      await sleep(800);

      const { filled, unfilled } = await autofill(page, profile.values, profile.resumeAbsPath);

      await fs.promises.mkdir(SHOTS_DIR, { recursive: true });
      const rel = path.join("screenshots", `${appId}.png`);
      try {
        await page.screenshot({ path: path.join(UPLOADS_DIR, rel) });
      } catch {
        /* screenshot is a nice-to-have */
      }

      try {
        await page.bringToFront();
      } catch {
        /* headless */
      }

      await Application.updateOne(
        { _id: appId },
        {
          $set: {
            status: "ready_for_review",
            filled,
            unfilled,
            screenshotPath: rel,
            preparedAt: new Date(),
            error: "",
          },
        }
      );
      return { status: "ready_for_review", filled, unfilled };
    } catch (err) {
      console.warn(`[apply] prepare ${appId} failed: ${err.message}`);
      await Application.updateOne(
        { _id: appId },
        { $set: { status: "failed", error: err.message } }
      );
      return { status: "failed", error: err.message };
    }
  });
}
