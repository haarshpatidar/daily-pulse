import mongoose from "mongoose";

// The user's reusable application details — contact info, work-authorization,
// and a bag of saved answers to common screening questions. Single-user app, so
// there is exactly one of these documents; routes read/write it as a singleton.
const applyProfileSchema = new mongoose.Schema(
  {
    // a fixed key so we can upsert the one-and-only profile without juggling ids
    singleton: { type: String, default: "me", unique: true },

    firstName: { type: String, default: "", trim: true },
    lastName: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    phone: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    country: { type: String, default: "", trim: true },

    headline: { type: String, default: "", trim: true },
    currentCompany: { type: String, default: "", trim: true },
    currentTitle: { type: String, default: "", trim: true },
    totalExperienceYears: { type: Number, default: null },
    currentCtc: { type: String, default: "", trim: true },
    expectedCtc: { type: String, default: "", trim: true },
    noticePeriodDays: { type: Number, default: null },

    workAuthorized: { type: Boolean, default: true },
    requiresSponsorship: { type: Boolean, default: false },

    linkedinUrl: { type: String, default: "", trim: true },
    githubUrl: { type: String, default: "", trim: true },
    portfolioUrl: { type: String, default: "", trim: true },

    coverLetterTemplate: { type: String, default: "" },

    // reusable answers to screening questions the autofill engine matches by
    // label, e.g. { label: "Years of React experience", value: "4" }
    extraAnswers: {
      type: [{ label: { type: String, trim: true }, value: { type: String, trim: true } }],
      default: [],
    },

    // metadata for the uploaded resume file (the bytes live on disk under uploads/)
    resumeFile: {
      originalName: { type: String, default: "" },
      storedName: { type: String, default: "" },
      mimeType: { type: String, default: "" },
      size: { type: Number, default: 0 },
      uploadedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

export default mongoose.model("ApplyProfile", applyProfileSchema);
