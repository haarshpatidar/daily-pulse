// Generic, platform-agnostic form autofiller.
//
// Rather than hand-coding each site, we walk every visible field on the page (or
// inside an opened apply modal), derive a human label for it from its <label> /
// aria-* / placeholder / name, and match that label against a synonym dictionary
// keyed to the user's profile. We fill what we recognize and report what we
// couldn't, so the user finishes the rest by hand. We NEVER click submit.
//
// All DOM work runs inside page.evaluate (text/select/radio). The resume file
// upload must be driven from Node via elementHandle.uploadFile, so it's done
// separately after the in-page pass.

// Build the flat value bag + yes/no answers + extra screening answers that the
// in-page matcher consumes. Kept here so the matching dictionary lives in one
// place next to the values it maps to.
export function buildProfileValues(profile) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const num = (n) => (n == null || n === "" ? "" : String(n));
  return {
    text: {
      email: profile.email || "",
      phone: profile.phone || "",
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      fullName,
      city: profile.city || "",
      country: profile.country || "",
      location: location || profile.city || "",
      headline: profile.headline || "",
      currentCompany: profile.currentCompany || "",
      currentTitle: profile.currentTitle || "",
      experience: num(profile.totalExperienceYears),
      currentCtc: profile.currentCtc || "",
      expectedCtc: profile.expectedCtc || "",
      noticePeriod: num(profile.noticePeriodDays),
      linkedin: profile.linkedinUrl || "",
      github: profile.githubUrl || "",
      portfolio: profile.portfolioUrl || "",
      coverLetter: profile.coverLetterTemplate || "",
    },
    yesno: {
      // wants is the answer we'd give to a yes/no question on this topic
      sponsorship: profile.requiresSponsorship ? "yes" : "no",
      workAuth: profile.workAuthorized ? "yes" : "no",
    },
    extras: (profile.extraAnswers || [])
      .filter((a) => a && a.label && a.value)
      .map((a) => ({ label: String(a.label).toLowerCase().trim(), value: String(a.value) })),
  };
}

// Run the fill. `values` is the output of buildProfileValues; `resumeAbsPath` is
// an absolute path to the resume file (or "" to skip the upload).
// Returns { filled: string[], unfilled: string[] }.
export async function autofill(page, values, resumeAbsPath) {
  const result = await page.evaluate((V) => {
    const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

    const isVisible = (el) => {
      const st = window.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0)
        return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };

    // Best-effort human label for a field, widest-net first.
    const labelText = (el) => {
      let txt = "";
      if (el.id) {
        const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lab) txt += " " + lab.textContent;
      }
      const anc = el.closest("label");
      if (anc) txt += " " + anc.textContent;
      const ariaLabel = el.getAttribute("aria-label");
      if (ariaLabel) txt += " " + ariaLabel;
      const labelledby = el.getAttribute("aria-labelledby");
      if (labelledby) {
        labelledby.split(/\s+/).forEach((id) => {
          const n = document.getElementById(id);
          if (n) txt += " " + n.textContent;
        });
      }
      if (!txt.trim()) {
        const grp = el.closest("div,fieldset,section,li,p,td");
        const lab = grp && grp.querySelector("label,legend,.label,strong,b");
        if (lab) txt += " " + lab.textContent;
      }
      txt += ` ${el.placeholder || ""} ${el.name || ""} ${el.id || ""}`;
      return norm(txt);
    };

    // A clean, human-readable label (no name/id/placeholder soup) for telling
    // the user which fields still need attention.
    const humanLabel = (el) => {
      let txt = "";
      if (el.id) {
        const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lab) txt += " " + lab.textContent;
      }
      const anc = el.closest("label");
      if (anc) txt += " " + anc.textContent;
      const al = el.getAttribute("aria-label");
      if (al) txt += " " + al;
      if (!txt.trim()) {
        const grp = el.closest("div,fieldset,section,li,p,td");
        const lab = grp && grp.querySelector("label,legend");
        if (lab) txt += " " + lab.textContent;
      }
      if (!txt.trim()) txt = el.placeholder || el.name || "this field";
      return norm(txt).replace(/\s*\*\s*/g, " ").replace(/\brequired\b/gi, "").replace(/\s+/g, " ").trim();
    };

    const setValue = (el, value) => {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const has = (label, words) => words.some((w) => label.includes(w));

    // Ordered specific-first so "last name" wins before the generic "name".
    const TEXT_RULES = [
      ["email", V.text.email, ["e-mail", "email"]],
      ["phone", V.text.phone, ["phone", "mobile", "contact number", "telephone", "tel "]],
      ["firstName", V.text.firstName, ["first name", "given name", "fname", "first_name"]],
      ["lastName", V.text.lastName, ["last name", "surname", "family name", "lname", "last_name"]],
      ["fullName", V.text.fullName, ["full name", "your name", "candidate name", "applicant name"]],
      ["linkedin", V.text.linkedin, ["linkedin"]],
      ["github", V.text.github, ["github"]],
      ["portfolio", V.text.portfolio, ["portfolio", "personal website", "personal site", "website url"]],
      ["currentCompany", V.text.currentCompany, ["current company", "current employer", "present company", "employer name"]],
      ["currentTitle", V.text.currentTitle, ["current title", "job title", "current role", "designation", "current position"]],
      ["experience", V.text.experience, ["years of experience", "total experience", "work experience", "years experience", "experience in years", "yrs of exp"]],
      ["expectedCtc", V.text.expectedCtc, ["expected salary", "expected ctc", "expected compensation", "desired salary", "salary expectation"]],
      ["currentCtc", V.text.currentCtc, ["current salary", "current ctc", "current compensation"]],
      ["noticePeriod", V.text.noticePeriod, ["notice period", "availability to start", "how soon can you join"]],
      ["headline", V.text.headline, ["headline", "professional summary", "profile summary", "about you"]],
      ["city", V.text.city, ["city", "town"]],
      ["country", V.text.country, ["country"]],
      ["location", V.text.location, ["location", "current location", "where are you based", "address"]],
      ["coverLetter", V.text.coverLetter, ["cover letter", "why do you want", "message to the", "additional information", "anything else", "tell us about yourself"]],
      // generic fallbacks, last
      ["fullName", V.text.fullName, ["name"]],
    ];

    const YESNO_RULES = [
      ["sponsorship", V.yesno.sponsorship, ["sponsor", "require sponsorship", "visa sponsor", "need sponsorship"]],
      ["workAuth", V.yesno.workAuth, ["authorized to work", "authorised to work", "work authorization", "work authorisation", "legally authorized", "legally authorised", "right to work", "eligible to work", "permitted to work"]],
    ];

    const filled = [];
    const unfilled = [];
    const seenUnfilled = new Set();

    const isRequired = (el, label) =>
      el.required ||
      el.getAttribute("aria-required") === "true" ||
      /\*|\brequired\b/.test(label);

    const noteUnfilled = (el) => {
      const clean = humanLabel(el);
      const key = clean.slice(0, 60);
      if (clean && clean !== "this field" && !seenUnfilled.has(key)) {
        seenUnfilled.add(key);
        unfilled.push(clean.slice(0, 80));
      }
    };

    // --- text inputs & textareas ---
    const textEls = [...document.querySelectorAll("input, textarea")].filter((el) => {
      if (el instanceof HTMLTextAreaElement) return isVisible(el) && !el.disabled && !el.readOnly;
      const t = (el.type || "text").toLowerCase();
      const skip = ["hidden", "file", "submit", "button", "image", "reset", "checkbox", "radio", "password"];
      return !skip.includes(t) && isVisible(el) && !el.disabled && !el.readOnly;
    });

    for (const el of textEls) {
      const label = labelText(el);
      if (el.value && el.value.trim()) continue; // don't clobber prefilled values
      let done = false;
      for (const [name, value, words] of TEXT_RULES) {
        if (value && has(label, words)) {
          setValue(el, value);
          filled.push(name);
          done = true;
          break;
        }
      }
      if (done) continue;
      // try saved screening answers by fuzzy label containment
      const extra = V.extras.find((a) => a.label.length > 3 && label.includes(a.label));
      if (extra) {
        setValue(el, extra.value);
        filled.push(`answer:${extra.label.slice(0, 30)}`);
        continue;
      }
      if (isRequired(el, label)) noteUnfilled(el);
    }

    // --- selects ---
    const selectEls = [...document.querySelectorAll("select")].filter(
      (el) => isVisible(el) && !el.disabled
    );
    const pickOption = (el, wanted) => {
      const w = norm(wanted);
      if (!w) return false;
      const opts = [...el.options];
      const opt =
        opts.find((o) => norm(o.textContent) === w || norm(o.value) === w) ||
        opts.find((o) => {
          const t = norm(o.textContent);
          return t && (t.includes(w) || w.includes(t));
        });
      if (opt) {
        el.value = opt.value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      return false;
    };
    for (const el of selectEls) {
      const label = labelText(el);
      const cur = norm(el.value);
      if (cur && cur !== "select" && !/^(please|choose|--)/.test(cur)) continue;
      let done = false;
      for (const [name, wants, words] of YESNO_RULES) {
        if (has(label, words)) {
          if (pickOption(el, wants)) {
            filled.push(name);
            done = true;
          }
          break;
        }
      }
      if (done) continue;
      for (const [name, value, words] of TEXT_RULES) {
        if (value && has(label, words) && pickOption(el, value)) {
          filled.push(name);
          done = true;
          break;
        }
      }
      if (!done && isRequired(el, label)) noteUnfilled(el);
    }

    // --- radio groups for yes/no questions ---
    const radios = [...document.querySelectorAll("input[type=radio]")].filter(
      (el) => isVisible(el) && !el.disabled
    );
    const byName = {};
    for (const r of radios) (byName[r.name] = byName[r.name] || []).push(r);
    for (const group of Object.values(byName)) {
      if (group.some((r) => r.checked)) continue;
      // label for the group = nearest fieldset/legend or container text
      const container = group[0].closest("fieldset,div,section,li,p") || group[0].parentElement;
      const groupLabel = norm(container ? container.textContent : "");
      for (const [name, wants, words] of YESNO_RULES) {
        if (has(groupLabel, words)) {
          const target = group.find((r) => labelText(r).includes(wants) || norm(r.value) === wants);
          if (target) {
            target.checked = true;
            target.dispatchEvent(new Event("input", { bubbles: true }));
            target.dispatchEvent(new Event("change", { bubbles: true }));
            target.click?.();
            filled.push(name);
          }
          break;
        }
      }
    }

    return { filled: [...new Set(filled)], unfilled: unfilled.slice(0, 25) };
  }, values);

  // --- resume upload (Node side) ---
  if (resumeAbsPath) {
    try {
      const fileInputs = await page.$$("input[type=file]");
      for (const fi of fileInputs) {
        const accept = (await fi.evaluate((el) => el.getAttribute("accept") || "")).toLowerCase();
        // upload to the first input that takes documents (or declares no filter)
        if (accept && !/pdf|doc|word|application|\*/.test(accept)) continue;
        await fi.uploadFile(resumeAbsPath);
        result.filled.push("resume");
        break;
      }
    } catch {
      result.unfilled.push("resume (upload it manually)");
    }
  }

  result.filled = [...new Set(result.filled)];
  return result;
}
