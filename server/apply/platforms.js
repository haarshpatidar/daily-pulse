// Per-platform configuration for the assisted-apply engine. Each entry tells the
// engine how to recognize a login wall, confirm a logged-in session, and open
// the application form. Selectors are best-effort and WILL drift as the sites
// change — the generic autofill engine is the safety net when a trigger or
// detection selector goes stale, so a wrong selector degrades to "fill what we
// can", never a crash.
//
// `tuned: true`  -> we've shaped the flow for this site (LinkedIn Easy Apply).
// `tuned: false` -> handled purely by the generic engine (best-effort).

export const PLATFORM_CONFIG = {
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    tuned: true,
    hostnames: ["linkedin.com"],
    loginUrl: "https://www.linkedin.com/login",
    // the session cookie LinkedIn sets on sign-in — the reliable logged-in signal
    authCookie: "li_at",
    // present only on a login/auth wall
    loginWallSelector: "input#username, form.login__form, .authwall-join-form, .join-form",
    // present only once authenticated (the top-nav "Me" avatar)
    loggedInSelector: "img.global-nav__me-photo, .global-nav__me, [data-control-name='nav.settings']",
    // the in-page "Easy Apply" button that opens the application modal
    applyTriggers: [
      "button.jobs-apply-button",
      "button[aria-label*='Easy Apply']",
      ".jobs-s-apply button",
    ],
  },

  indeed: {
    id: "indeed",
    label: "Indeed",
    tuned: false,
    hostnames: ["indeed.com"],
    loginUrl: "https://secure.indeed.com/account/login",
    loginWallSelector: "#login-email-input, form[data-tn-element='loginForm'], input[name='__email']",
    loggedInSelector: "[data-gnav-element-name='AccountMenu'], #gnav-main-AccountMenu",
    applyTriggers: [
      "#indeedApplyButton",
      "button[aria-label*='Apply now']",
      ".jobsearch-IndeedApplyButton",
      "button.ia-IndeedApplyButton",
    ],
  },

  glassdoor: {
    id: "glassdoor",
    label: "Glassdoor",
    tuned: false,
    hostnames: ["glassdoor.com", "glassdoor.co.in"],
    loginUrl: "https://www.glassdoor.com/profile/login_input.htm",
    loginWallSelector: "input[name='username'], .authModal, [data-test='emailInput']",
    loggedInSelector: "[data-test='member-home'], .member-home, [alt='profile icon']",
    applyTriggers: [
      "button[data-test='easyApply']",
      "a[data-test='applyButton']",
      "button.applyButton",
    ],
  },

  instahyre: {
    id: "instahyre",
    label: "Instahyre",
    tuned: false,
    hostnames: ["instahyre.com"],
    loginUrl: "https://www.instahyre.com/login/",
    loginWallSelector: "input#id_email, form.login-form, input[name='email']",
    loggedInSelector: ".navbar-profile, .dropdown-toggle .profile-img, a[href*='logout']",
    applyTriggers: [
      "button.apply-button",
      "button[ng-click*='apply']",
      "a.btn-apply",
    ],
  },

  internshala: {
    id: "internshala",
    label: "Internshala",
    tuned: false,
    hostnames: ["internshala.com"],
    loginUrl: "https://internshala.com/login/student",
    loginWallSelector: "#email, #modal_login_form, input[name='email']",
    loggedInSelector: "#profile_container, .training_profile, a[href*='logout']",
    applyTriggers: [
      "#easy_apply_button",
      ".apply_now_button",
      "button#continue_apply_button",
    ],
  },
};

const HOST_INDEX = Object.values(PLATFORM_CONFIG).flatMap((cfg) =>
  cfg.hostnames.map((h) => [h, cfg.id])
);

// Map an apply URL to a known platform id (or "other" when unrecognized).
export function detectPlatform(url) {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "other";
  }
  for (const [hostname, id] of HOST_INDEX) {
    if (host === hostname || host.endsWith(`.${hostname}`)) return id;
  }
  return "other";
}

// Config for a platform id, with a permissive generic fallback for "other".
export function getPlatformConfig(platform) {
  return (
    PLATFORM_CONFIG[platform] || {
      id: "other",
      label: "Other",
      tuned: false,
      hostnames: [],
      loginUrl: "",
      // no reliable wall/login selectors off-platform — assume usable and let
      // the generic engine fill whatever form is on the page
      loginWallSelector: "",
      loggedInSelector: "",
      applyTriggers: [
        "button[aria-label*='Apply' i]",
        "a[aria-label*='Apply' i]",
        "button.apply",
        "a.apply",
      ],
    }
  );
}

export function isTuned(platform) {
  return !!getPlatformConfig(platform).tuned;
}
