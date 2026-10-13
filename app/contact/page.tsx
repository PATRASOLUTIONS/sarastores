"use client"

import { useState } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import Link from "next/link"
import { toast } from "react-hot-toast"
import {
  ArrowRight,
  Award,
  Boxes,
  Building2,
  Gift,
  Globe,
  Handshake,
  Headphones,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  MonitorPlay,
  Phone,
  ShieldCheck,
  Store,
  Tag,
  UserCog,
  Users,
  Wrench,
} from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { useSettingsData } from "@/hooks/useSettingsData"
import styles from "./contact.module.css"

const ENQUIRY_TYPES = [
  { icon: Boxes, label: "Bulk Purchase" },
  { icon: Gift, label: "Corporate Gifting" },
  { icon: Building2, label: "Institutional Sales" },
  { icon: Handshake, label: "Reseller / Dealer Partnership" },
  { icon: MonitorPlay, label: "Product Demo & Evaluation" },
  { icon: MessageCircle, label: "Others" },
]

const SUPPORT_TYPES = [
  { icon: Boxes, label: "Order Support" },
  { icon: Gift, label: "Product Enquiry" },
  { icon: Wrench, label: "Service & Installation" },
  { icon: ShieldCheck, label: "Warranty Claim" },
  { icon: Building2, label: "Bulk / Business" },
  { icon: MessageCircle, label: "Feedback" },
]

const HERO_POINTS = [
  { icon: Tag, title: "Best Prices", detail: "for Bulk Orders" },
  { icon: Boxes, title: "Wide Range", detail: "of Products" },
  { icon: Headphones, title: "Dedicated", detail: "Account Support" },
  { icon: MapPin, title: "Pan-Karnataka", detail: "Service Network" },
]

const WHY_US = [
  { icon: Globe, title: "Wide Range", detail: "of Global Brands" },
  { icon: Tag, title: "Competitive", detail: "Pricing" },
  { icon: Building2, title: "Pan-Karnataka", detail: "Presence" },
  { icon: ShieldCheck, title: "Reliable After-Sales", detail: "Support" },
  { icon: MonitorPlay, title: "Customised", detail: "Solutions" },
  { icon: UserCog, title: "Dedicated", detail: "Relationship Manager" },
]

const CITIES = [
  "Bengaluru",
  "Mysuru",
  "Mangaluru",
  "Hubballi",
  "Belagavi",
  "Davanagere",
  "Ballari",
  "Kalaburagi",
  "Shivamogga",
  "Tumakuru",
  "Other",
]

function Script({ className = "", lines }: { className?: string; lines: string[] }) {
  return (
    <p className={`font-script leading-tight ${className}`}>
      {lines.map((line, i) => (
        <span key={line} className={i === 1 ? "ml-4 block" : "block"}>
          {line}
        </span>
      ))}
      <svg viewBox="0 0 120 12" className="mt-1 h-2.5 w-24" fill="none" aria-hidden>
        <path d="M2 9C26 3 62 2 90 4c10 .8 20 2.6 28 5" stroke="#E11D2E" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </p>
  )
}

export default function ContactPage() {
  const { data: settings } = useSettingsData()

  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    enquiryType: "",
    city: "",
    message: "",
  })
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const lock = useSubmitLock()
  const [submitted, setSubmitted] = useState(false)

  const phone = settings?.storePhone || "1800 123 7272"
  const email = settings?.storeEmail || "support@saraelectronics.in"
  const address = settings?.storeAddress || "SARA Head Office, Bengaluru, Karnataka"
  const years = settings?.statYears || "25+"
  const stores = settings?.statStores || "85+"
  const customers = settings?.statCustomers || "2,00,000+"

  const update =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (Object.values(form).some((value) => !value.trim())) {
      toast.error("Please fill in all required fields")
      return
    }
    const cleanPhone = form.phone.replace(/\D/g, "")
    if (!/^\d{10}$/.test(cleanPhone)) {
      toast.error("Please enter a valid 10-digit phone number")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("Please enter a valid email address")
      return
    }
    if (!consent) {
      toast.error("Please accept the Terms & Conditions and Privacy Policy")
      return
    }
    if (!lock.acquire()) return

    setSubmitting(true)
    try {
      const response = await fetch("/api/contact-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: cleanPhone,
          consent,
          source: "contact_page",
        }),
      })
      const data = await response.json()

      if (response.ok && data.success) {
        toast.success("Thank you! We will contact you soon.")
        setSubmitted(true)
        setForm({ name: "", company: "", email: "", phone: "", enquiryType: "", city: "", message: "" })
        setConsent(false)
      } else {
        toast.error(typeof data.error === "string" ? data.error : data.error?.message || "Failed to submit. Please try again.")
      }
    } catch (error) {
      console.error("Error submitting form:", error)
      toast.error("An error occurred. Please try again later.")
    } finally {
      lock.release()
      setSubmitting(false)
    }
  }

  const inputClass =
    "mt-1 h-8 w-full rounded border border-[#D3DFF1] px-2 text-[11px] text-[#071B50] placeholder:text-[#7180A2] focus:border-[#005BFF] focus:outline-none focus:ring-1 focus:ring-[#005BFF]"
  const labelClass = "block text-[12px] font-semibold text-gray-700"

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />

      <main className={`${styles.page} flex-grow`}>
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className={`${styles.hero} relative overflow-hidden text-white`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/contact/business-handshake.webp"
            alt=""
            aria-hidden
            className={styles.heroImage}
          />

          <div className={`${styles.container} relative z-10 py-4`}>
            <nav className="flex items-center gap-2 text-[12px] text-white/70" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-white">
                Home
              </Link>
              <span className="text-white/40">/</span>
              <span className="font-medium text-white">Business Enquiries</span>
            </nav>

            <div className={styles.heroContent}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/90">Business Enquiries</p>
              <h1 className="mt-2 font-heading text-[36px] font-extrabold leading-[1.02] md:text-[46px]">
                Let&apos;s Grow
                <br />
                Together
              </h1>
              <p className="mt-3 max-w-[335px] text-[15px] leading-[1.4] text-white">
                Partner with SARA for bulk purchases, corporate solutions, institutional sales and customised technology needs.
              </p>

              <ul className={styles.heroPoints}>
                {HERO_POINTS.map(({ icon: Icon, title, detail }) => (
                  <li key={title}>
                    <Icon className="h-5 w-5 text-white" strokeWidth={1.5} />
                    <p className="mt-1.5 text-[12px] font-semibold leading-tight">{title}</p>
                    <p className="text-[11px] leading-tight text-white/70">{detail}</p>
                  </li>
                ))}
              </ul>
            </div>

            <Script
              className={styles.heroScript}
              lines={["Happier Homes", "Brighter Lives"]}
            />
          </div>
        </section>

        <div className={`${styles.container} ${styles.body}`}>
          {/* ── Form + side cards ────────────────────────────────── */}
          <div className={styles.columns}>
            <section className={styles.formCard} aria-labelledby="enquiry-form">
              <h2 id="enquiry-form" className="font-heading text-lg font-bold text-gray-900">
                Send Us Your Enquiry
              </h2>
              <p className="mt-1 text-[13px] text-gray-500">
                Fill in your details and our team will get back to you shortly.
              </p>

              {submitted ? (
                <div className="mt-8 rounded-lg bg-[#EAF2FC] p-6 text-center">
                  <p className="font-heading text-lg font-bold text-[#0F2557]">Enquiry received</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Thanks for reaching out — we will call or email you shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="mt-4 text-[13px] font-semibold text-[#1560BD] hover:underline"
                  >
                    Send another enquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>
                      Full Name <span className="text-[#E11D2E]">*</span>
                    </span>
                    <input
                      name="name"
                      value={form.name}
                      onChange={update("name")}
                      placeholder="Enter your full name"
                      autoComplete="name"
                      minLength={2}
                      maxLength={100}
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Company / Organisation Name <span className="text-[#E11D2E]">*</span></span>
                    <input
                      name="company"
                      value={form.company}
                      onChange={update("company")}
                      placeholder="Enter company name"
                      autoComplete="organization"
                      maxLength={150}
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>
                      Email ID <span className="text-[#E11D2E]">*</span>
                    </span>
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={update("email")}
                      placeholder="Enter your email address"
                      autoComplete="email"
                      maxLength={255}
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>
                      Mobile Number <span className="text-[#E11D2E]">*</span>
                    </span>
                    <input
                      name="phone"
                      value={form.phone}
                      type="tel"
                      onChange={update("phone")}
                      inputMode="numeric"
                      placeholder="Enter mobile number"
                      autoComplete="tel-national"
                      pattern={String.raw`[0-9\s\(\)\+\-]{10,20}`}
                      maxLength={20}
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Enquiry Type <span className="text-[#E11D2E]">*</span></span>
                    <select name="enquiryType" required value={form.enquiryType} onChange={update("enquiryType")} className={`${inputClass} bg-white`}>
                      <option value="">Select enquiry type</option>
                      <optgroup label="Business enquiries">
                      {ENQUIRY_TYPES.map(({ label }) => (
                        <option key={label}>{label}</option>
                      ))}
                      </optgroup>
                      <optgroup label="Customer support">
                        {SUPPORT_TYPES.map(({ label }) => <option key={label}>{label}</option>)}
                      </optgroup>
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClass}>City <span className="text-[#E11D2E]">*</span></span>
                    <select name="city" required value={form.city} onChange={update("city")} className={`${inputClass} bg-white`}>
                      <option value="">Select city</option>
                      {CITIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={labelClass}>Your Message <span className="text-[#E11D2E]">*</span></span>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={update("message")}
                      rows={4}
                      required
                      maxLength={5000}
                      placeholder="Tell us about your requirement..."
                      className={`${styles.message} mt-1 w-full rounded border border-[#D3DFF1] px-2 py-2 text-[11px] placeholder:text-[#7180A2] focus:border-[#005BFF] focus:outline-none focus:ring-1 focus:ring-[#005BFF]`}
                    />
                  </label>

                  <label className="flex items-start gap-2 sm:col-span-2">
                    <input
                      name="consent"
                      type="checkbox"
                      required
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#1560BD] focus:ring-[#1560BD]"
                    />
                    <span className="text-[12px] text-gray-600">
                      I agree to the{" "}
                      <Link href="/terms-and-conditions" className="font-semibold text-[#1560BD] hover:underline">
                        Terms &amp; Conditions
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy-policy" className="font-semibold text-[#1560BD] hover:underline">
                        Privacy Policy
                      </Link>
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded bg-[#005BFF] text-[13px] font-semibold text-white transition-colors hover:bg-[#0045C7] disabled:opacity-60 sm:col-span-2"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Submit Enquiry
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}
            </section>

            <div className={styles.sideCards}>
              <section className={styles.typesCard} aria-labelledby="enquiry-types">
                <h2 id="enquiry-types" className="font-heading text-base font-bold text-gray-900">
                  Enquiry Types
                </h2>
                <p className="mt-1 text-[12px] text-gray-600">Choose the category that best fits your requirement.</p>
                <ul className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {ENQUIRY_TYPES.map(({ icon: Icon, label }) => (
                    <li key={label}>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, enquiryType: label }))}
                        aria-pressed={form.enquiryType === label}
                        className={`flex h-full min-h-[78px] w-full flex-col items-center justify-center gap-2 rounded border bg-white px-2 py-3 text-center transition-colors ${
                          form.enquiryType === label ? "border-[#005BFF] ring-1 ring-[#005BFF]" : "border-transparent hover:border-[#005BFF]/50"
                        }`}
                      >
                        <Icon className="h-7 w-7 text-[#005BFF]" strokeWidth={1.6} />
                        <span className="text-[11px] font-semibold leading-tight text-gray-700">{label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className={styles.supportCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/contact/support-advisor.webp" alt="SARA customer support advisor" className={styles.supportImage} />
                <h2 className="font-heading text-base font-bold text-gray-900">Prefer to speak with us directly?</h2>
                <ul className={`${styles.supportDetails} mt-3 space-y-3 text-[13px]`}>
                  <li className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1560BD] text-white">
                      <Phone className="h-4 w-4" />
                    </span>
                    <div>
                      <a href={`tel:${phone.replace(/\s/g, "")}`} className="font-bold text-gray-900 hover:underline">
                        {phone}
                      </a>
                    </div>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1560BD] text-white">
                      <Mail className="h-4 w-4" />
                    </span>
                    <a href={`mailto:${email}`} className="break-all font-medium text-gray-900 hover:underline">
                      {email}
                    </a>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1560BD] text-white">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-bold text-gray-900">SARA Head Office</p>
                      <p className="text-[12px] leading-snug text-gray-600">{address}</p>
                    </div>
                  </li>
                </ul>
                <Script
                  className={styles.supportScript}
                  lines={["Happier Homes", "Brighter Lives"]}
                />
              </section>
            </div>
          </div>

          {/* ── Why choose SARA ──────────────────────────────────── */}
          <section aria-labelledby="why-sara">
            <h2 id="why-sara" className="font-heading text-lg font-bold text-gray-900">
              Why Businesses Choose SARA
            </h2>
            <ul className={styles.whyList}>
              {WHY_US.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex items-center gap-3 bg-white px-3 py-2">
                  <Icon className="h-7 w-7 flex-shrink-0 text-[#005BFF]" strokeWidth={1.6} />
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold leading-tight text-gray-900">{title}</p>
                    <p className="text-[11px] leading-tight text-gray-500">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

        </div>
          <section className={styles.partnership}>
            <div className={styles.storeImage}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/contact/partnership-store.webp" alt="SARA electronics store" className="h-full w-full object-cover" />
            </div>
            <div className={styles.partnershipContent}>
              <h2 className="font-heading text-2xl font-bold leading-tight sm:text-[28px]">
                From Possibilities
                <br />
                to Partnerships
              </h2>
              <p className="mt-3 text-sm text-white/80">
                Let&apos;s create smarter solutions for a brighter tomorrow.
              </p>
              <Link
                href="#enquiry-form"
                className="mt-3 inline-flex items-center gap-2 rounded bg-white px-5 py-2 text-[12px] font-semibold text-[#0F2557] hover:bg-blue-50"
              >
                Get in Touch
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Script
                className={styles.partnershipScript}
                lines={["Happier Homes", "Brighter Lives"]}
              />
            </div>
          </section>

          {/* ── Stats ────────────────────────────────────────────── */}
          <section className={`${styles.container} ${styles.stats}`} aria-label="SARA at a glance">
            <ul className="grid grid-cols-2 gap-y-3 lg:grid-cols-4">
              {[
                { icon: Award, value: `${years} Years`, label: "of Trust" },
                { icon: Store, value: stores, label: "Stores Across Karnataka" },
                { icon: Users, value: customers, label: "Happy Customers" },
                { icon: Handshake, value: "Your Trusted", label: "Technology Partner" },
              ].map(({ icon: Icon, value, label }) => (
                <li key={label} className="flex items-center justify-center gap-4 bg-white px-4">
                  <Icon className="h-9 w-9 flex-shrink-0 text-[#005BFF]" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="font-heading text-[15px] font-bold leading-tight text-gray-900">{value}</p>
                    <p className="text-[11px] leading-tight text-gray-500">{label}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
      </main>

      <Footer />
    </div>
  )
}
