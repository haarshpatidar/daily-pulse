import mongoose from "mongoose";

export const PLATFORMS = [
  "linkedin",
  "indeed",
  "glassdoor",
  "instahyre",
  "internshala",
  "other",
];

export const STATUSES = [
  "queued", // user added it; not prepared yet
  "preparing", // headful browser is opening + auto-filling
  "needs_login", // the platform showed a login wall — user must sign in first
  "ready_for_review", // form pre-filled, waiting for the user to review + submit
  "submitted", // user submitted it manually and marked it done
  "skipped", // user chose not to apply
  "failed", // prepare crashed / page unreachable
  "external", // not auto-fillable (e.g. redirects off-platform) — open manually
];

// One row per job the user wants to (or did) apply to. Acts as both the apply
// queue and a lightweight application tracker.
const applicationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    company: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },

    platform: { type: String, enum: PLATFORMS, default: "other" },
    applyUrl: { type: String, required: true, unique: true },
    sourceJobUrl: { type: String, default: "" },
    // the scraped Job this came from, if it originated in the Jobs feed
    jobRef: { type: mongoose.Schema.Types.ObjectId, ref: "Job", default: null },

    status: { type: String, enum: STATUSES, default: "queued" },

    // names of the fields the autofill engine filled / couldn't fill, so the UI
    // can tell the user exactly what to finish by hand before submitting
    filled: { type: [String], default: [] },
    unfilled: { type: [String], default: [] },

    // path (relative to uploads/) of the post-fill screenshot, for a UI preview
    screenshotPath: { type: String, default: "" },

    note: { type: String, default: "" },
    error: { type: String, default: "" },

    queuedAt: { type: Date, default: Date.now },
    preparedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

applicationSchema.index({ status: 1, updatedAt: -1 });

export default mongoose.model("Application", applicationSchema);
