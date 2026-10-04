/**
 * DPDP Act 2023 configuration — the identity and contact details a Data
 * Fiduciary is legally required to publish.
 *
 * Section 5 requires the notice to identify the Data Fiduciary and tell the
 * Data Principal how to reach a person who can answer questions about
 * processing. Section 13 requires a published grievance route. None of that
 * can be hardcoded in a component, because the legal entity, the registered
 * office and the named officer change independently of the code.
 *
 * Everything here reads from `process.env` with a clearly-marked placeholder
 * fallback, so a missing value renders as a visible "not configured" string
 * rather than a plausible-looking lie in a legal notice.
 */

/** Rendered wherever a required legal value has not been configured yet. */
export const NOT_CONFIGURED = "[Not configured — set in .env.local]"

function env(name: string, fallback: string = NOT_CONFIGURED): string {
  const value = process.env[name]
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback
}

/**
 * Bump this whenever the privacy notice changes in a way that alters what a
 * person is agreeing to. Every consent record stores the version that was on
 * screen at the time, which is what makes a historical consent provable.
 */
export const PRIVACY_NOTICE_VERSION = env("NEXT_PUBLIC_PRIVACY_NOTICE_VERSION", "2026-10-01.1")

/** India's statutory age of majority. DPDP has no lower "teen" tier. */
export const DPDP_AGE_OF_MAJORITY = 18

/**
 * GST invoice records must be retained for 72 months, so order and payment
 * documents survive an erasure request. The identity inside them does not.
 */
export const GST_RETENTION_MONTHS = 72

export const dpdpConfig = {
  /** Registered legal entity of the Data Fiduciary. */
  legalEntity: env("DPDP_LEGAL_ENTITY"),
  /** Registered office address, as filed. */
  registeredAddress: env("DPDP_REGISTERED_ADDRESS"),
  cin: env("DPDP_CIN", ""),
  gstin: env("DPDP_GSTIN", ""),

  /** Section 8(9)/13 contact — the person who answers processing questions. */
  grievanceOfficer: {
    name: env("DPDP_GRIEVANCE_OFFICER_NAME"),
    designation: env("DPDP_GRIEVANCE_OFFICER_DESIGNATION", "Grievance Officer"),
    email: env("DPDP_GRIEVANCE_OFFICER_EMAIL"),
    phone: env("DPDP_GRIEVANCE_OFFICER_PHONE", ""),
    address: env("DPDP_GRIEVANCE_OFFICER_ADDRESS", ""),
  },

  /**
   * Only required if the Central Government designates the company a
   * Significant Data Fiduciary under Section 10. Left blank otherwise.
   */
  dataProtectionOfficer: {
    name: env("DPDP_DPO_NAME", ""),
    email: env("DPDP_DPO_EMAIL", ""),
  },
  isSignificantDataFiduciary: process.env.DPDP_SIGNIFICANT_DATA_FIDUCIARY === "true",

  /** Days to resolve a grievance. The DPDP Rules cap this at 90. */
  grievanceSlaDays: Number.parseInt(env("DPDP_GRIEVANCE_SLA_DAYS", "30"), 10) || 30,

  privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
} as const

/** True only when every legally mandatory field has a real value. */
export function isDpdpConfigComplete(): boolean {
  return [
    dpdpConfig.legalEntity,
    dpdpConfig.registeredAddress,
    dpdpConfig.grievanceOfficer.name,
    dpdpConfig.grievanceOfficer.email,
  ].every((value) => value !== NOT_CONFIGURED)
}

/**
 * Recipients of personal data, disclosed under Section 11(b). A Data Principal
 * is entitled to the identities of everyone their data has been shared with,
 * so this list is rendered in the notice and returned by the data export.
 */
export type Recipient = {
  name: string
  purpose: string
  dataShared: string
  location: string
}

export const DATA_RECIPIENTS: Recipient[] = [
  {
    name: "Razorpay Software Private Limited",
    purpose: "Payment processing and refunds",
    dataShared: "Name, email, phone, order amount. Card details go directly to the gateway and are never stored by us.",
    location: "India",
  },
  {
    name: "Courier and logistics partners",
    purpose: "Delivery and installation of your order",
    dataShared: "Name, phone, delivery address, order contents",
    location: "India",
  },
  {
    name: "Retail and channel partners using our Partner API",
    purpose: "Fulfilment of orders you place through a partner storefront",
    dataShared: "Name, email, phone, delivery address, order contents, order status",
    location: "India",
  },
  {
    name: "MongoDB Atlas",
    purpose: "Database hosting",
    dataShared: "All stored account, order and support data",
    location: "India region cluster",
  },
  {
    name: "Vercel Inc.",
    purpose: "Website hosting and performance measurement",
    dataShared: "Technical request data, page performance metrics",
    location: "United States",
  },
  {
    name: "Google LLC",
    purpose: "Sign-in with Google, reCAPTCHA bot protection, and analytics where you consent",
    dataShared: "Email and name for sign-in; technical signals for reCAPTCHA; usage data only with analytics consent",
    location: "United States",
  },
  {
    name: "Email and WhatsApp delivery providers",
    purpose: "Order updates and, where you consent, marketing messages",
    dataShared: "Name, email, phone",
    location: "India",
  },
]

/**
 * Retention schedule published under Section 8(7) and enforced by the purge
 * job. Keeping the stated policy and the executed policy in one place stops
 * them drifting apart.
 */
export type RetentionRule = {
  collection: string
  label: string
  retention: string
  /** Null means "no fixed expiry" — deletion is event-driven, not time-driven. */
  days: number | null
  basis: string
  /** Date field the expiry is measured from. Required when `days` is set. */
  timestampField?: string
}

export const RETENTION_SCHEDULE: RetentionRule[] = [
  {
    collection: "orders",
    label: "Order and invoice records",
    retention: "72 months from the date of invoice",
    days: null,
    basis: "Mandatory under GST law. Identity fields are anonymised on account deletion; the financial record is kept.",
  },
  {
    collection: "users",
    label: "Account details",
    retention: "Until you delete your account",
    days: null,
    basis: "Needed to operate your account.",
  },
  {
    collection: "analytics_events",
    label: "Website usage events",
    retention: "14 months",
    days: 425,
    basis: "Consent-based analytics. Deleted automatically.",
    timestampField: "timestamp",
  },
  {
    collection: "web_vitals",
    label: "Page performance metrics",
    retention: "90 days",
    days: 90,
    basis: "Technical performance monitoring only.",
    timestampField: "createdAt",
  },
  {
    collection: "customer_events",
    label: "Marketing and consent activity log",
    retention: "26 months",
    days: 790,
    basis: "Retained to evidence consent decisions.",
    timestampField: "createdAt",
  },
  {
    collection: "carts",
    label: "Abandoned shopping carts",
    retention: "180 days after last update",
    days: 180,
    basis: "Purpose served once the cart is stale.",
    timestampField: "updatedAt",
  },
  {
    collection: "leads",
    label: "Enquiry and callback requests",
    retention: "24 months",
    days: 730,
    basis: "Sales follow-up.",
    timestampField: "createdAt",
  },
  {
    collection: "consent_records",
    label: "Consent audit trail",
    retention: "7 years after the consent ends",
    days: null,
    basis: "Needed to demonstrate lawful processing to the Data Protection Board.",
  },
]
