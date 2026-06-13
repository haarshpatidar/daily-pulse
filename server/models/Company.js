import mongoose from "mongoose";

// One discovered company "lead": the public contact emails we could find on the
// company's own site plus whatever firmographic detail was visible (founded
// year, headcount, rating…). Everything except `name` is best-effort and may be
// null when the source didn't expose it.
const emailSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, lowercase: true, trim: true },
    // "hr" = recruiting/people inbox, "general" = info/contact, "other" = rest
    type: { type: String, enum: ["hr", "general", "other"], default: "other" },
    source: { type: String, default: "" }, // page URL the address was found on
  },
  { _id: false }
);

const contactSchema = new mongoose.Schema(
  { name: { type: String, trim: true }, title: { type: String, trim: true } },
  { _id: false }
);

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, lowercase: true, trim: true }, // dedupe key
    domain: { type: String, default: "", lowercase: true, trim: true },
    website: { type: String, default: "" },

    emails: { type: [emailSchema], default: [] },
    hrContacts: { type: [contactSchema], default: [] }, // named people, when found
    hrNames: { type: [String], default: [] },

    // firmographics — null when not discoverable
    foundedYear: { type: Number, default: null },
    employeeCount: { type: Number, default: null },
    employeeRange: { type: String, default: "" }, // e.g. "51-200"
    industry: { type: String, default: "" },
    location: { type: String, default: "" },
    rating: { type: Number, default: null }, // 0–5 if a review score was found
    reviewCount: { type: Number, default: null },
    description: { type: String, default: "" },

    // does this company currently appear in our scraped Jobs?
    hiring: { type: Boolean, default: false },
    jobCount: { type: Number, default: 0 },

    // convenience counters so the API can filter/sort without touching the array
    emailCount: { type: Number, default: 0 },
    hrEmailCount: { type: Number, default: 0 },

    // which company-search batch surfaced this lead
    keyword: { type: String, default: "", lowercase: true, trim: true },
    status: { type: String, enum: ["pending", "enriched", "failed"], default: "pending" },
    scrapedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

companySchema.index({ nameKey: 1 }, { unique: true });
companySchema.index({ keyword: 1, hrEmailCount: -1 });
companySchema.index({ employeeCount: 1 });
companySchema.index({ foundedYear: 1 });

// Leads go stale; purge 90 days after the last write to keep the free cluster small.
companySchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export default mongoose.model("Company", companySchema);
