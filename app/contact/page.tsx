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
import { useBrandImages } from "@/hooks/useBrandImages"

const ENQUIRY_TYPES = [
  { icon: Boxes, label: "Order Support" },
  { icon: Gift, label: "Product Enquiry" },
  { icon: Wrench, label: "Service & Installation" },
  { icon: ShieldCheck, label: "Warranty Claim" },
  { icon: Building2, label: "Bulk / Business" },
  { icon: MessageCircle, label: "Feedback" },
]

const HERO_POINTS = [
  { icon: Headphones, title: "Dedicated Support", detail: "Real people, not bots" },
  { icon: Store, title: "Stores Near You", detail: "Across Karnataka" },
  { icon: Wrench, title: "Service & Install", detail: "Our own engineers" },
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
  const { storefront } = useBrandImages()

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

  // Same payload as before: leads require a pincode, and this form collects a city.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
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
      const parts = [form.enquiryType, form.city, form.company, form.message].filter(Boolean).join(" — ")
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: cleanPhone,
          pincode: "000000",
          category: "Contact Inquiry",
          source: `Contact Page${parts ? ` — ${parts.slice(0, 220)}` : ""}`,
        }),
      })
      const data = await response.json()

      if (data.success) {
        toast.success("Thank you! We will contact you soon.")
        setSubmitted(true)
        setForm({ name: "", company: "", email: "", phone: "", enquiryType: "", city: "", message: "" })
        setConsent(false)
      } else {
        toast.error(data.error || "Failed to submit. Please try again.")
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
    "mt-1.5 h-10 w-full rounded-md border border-gray-300 px-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-[#1560BD] focus:outline-none focus:ring-1 focus:ring-[#1560BD]"
  const labelClass = "block text-[12px] font-semibold text-gray-700"

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />

      <main className="flex-grow">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#0F2557] via-[#123A73] to-[#071634] text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={storefront}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-1/2 object-cover opacity-40 lg:block"
          />

          <div className="section-container relative z-10 py-10 md:py-12">
            <nav className="flex items-center gap-2 text-[12px] text-white/70" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-white">
                Home
              </Link>
              <span className="text-white/40">/</span>
              <span className="font-medium text-white">Contact Us</span>
            </nav>

            <div className="mt-6 max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">Contact Us</p>
              <h1 className="mt-3 font-heading text-[32px] font-extrabold leading-[1.08] md:text-[44px]">
                We&apos;re Here
                <br />
                to Help
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/80">
                Questions about an order, a product, a service visit or a bulk requirement — tell us what you
                need and the right team will come back to you.
              </p>

              <ul className="mt-7 flex flex-wrap divide-x divide-white/20">
                {HERO_POINTS.map(({ icon: Icon, title, detail }) => (
                  <li key={title} className="px-4 first:pl-0">
                    <Icon className="h-5 w-5 text-white" strokeWidth={1.5} />
                    <p className="mt-1.5 text-[12px] font-semibold leading-tight">{title}</p>
                    <p className="text-[11px] leading-tight text-white/70">{detail}</p>
                  </li>
                ))}
              </ul>
            </div>

            <Script
              className="absolute right-[46%] top-10 hidden text-xl text-white xl:block"
              lines={["Happier Homes", "Brighter Lives"]}
            />
          </div>
        </section>

        <div className="section-container space-y-8 py-8">
          {/* ── Form + side cards ────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <section className="rounded-xl border border-gray-200 bg-white p-6" aria-labelledby="enquiry-form">
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
                <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>
                      Full Name <span className="text-[#E11D2E]">*</span>
                    </span>
                    <input
                      value={form.name}
                      onChange={update("name")}
                      placeholder="Enter your full name"
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Company / Organisation</span>
                    <input
                      value={form.company}
                      onChange={update("company")}
                      placeholder="Enter company name"
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>
                      Email ID <span className="text-[#E11D2E]">*</span>
                    </span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={update("email")}
                      placeholder="Enter your email address"
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>
                      Mobile Number <span className="text-[#E11D2E]">*</span>
                    </span>
                    <input
                      value={form.phone}
                      onChange={update("phone")}
                      inputMode="numeric"
                      placeholder="Enter mobile number"
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Enquiry Type</span>
                    <select value={form.enquiryType} onChange={update("enquiryType")} className={`${inputClass} bg-white`}>
                      <option value="">Select enquiry type</option>
                      {ENQUIRY_TYPES.map(({ label }) => (
                        <option key={label}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClass}>City</span>
                    <select value={form.city} onChange={update("city")} className={`${inputClass} bg-white`}>
                      <option value="">Select city</option>
                      {CITIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={labelClass}>Your Message</span>
                    <textarea
                      value={form.message}
                      onChange={update("message")}
                      rows={4}
                      placeholder="Tell us about your requirement..."
                      className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2.5 text-[13px] placeholder:text-gray-400 focus:border-[#1560BD] focus:outline-none focus:ring-1 focus:ring-[#1560BD]"
                    />
                  </label>

                  <label className="flex items-start gap-2 sm:col-span-2">
                    <input
                      type="checkbox"
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
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1560BD] text-sm font-semibold text-white transition-colors hover:bg-[#0D4C99] disabled:opacity-60 sm:col-span-2"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Submit Enquiry
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}
            </section>

            <div className="space-y-5">
              <section className="rounded-xl border border-gray-200 bg-[#F5F9FE] p-6" aria-labelledby="enquiry-types">
                <h2 id="enquiry-types" className="font-heading text-base font-bold text-gray-900">
                  Enquiry Types
                </h2>
                <p className="mt-1 text-[12px] text-gray-500">Choose the category that best fits your requirement.</p>
                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {ENQUIRY_TYPES.map(({ icon: Icon, label }) => (
                    <li key={label}>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, enquiryType: label }))}
                        aria-pressed={form.enquiryType === label}
                        className={`flex h-full w-full flex-col items-center gap-2 rounded-lg border bg-white px-2 py-4 text-center transition-colors ${
                          form.enquiryType === label ? "border-[#1560BD] ring-1 ring-[#1560BD]" : "border-gray-200 hover:border-[#1560BD]/50"
                        }`}
                      >
                        <Icon className="h-5 w-5 text-[#1560BD]" strokeWidth={1.6} />
                        <span className="text-[11px] font-semibold leading-tight text-gray-700">{label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="relative overflow-hidden rounded-xl border border-gray-200 bg-[#F5F9FE] p-6">
                <h2 className="font-heading text-base font-bold text-gray-900">Prefer to speak with us directly?</h2>
                <ul className="mt-5 space-y-4 text-[13px]">
                  <li className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1560BD] text-white">
                      <Phone className="h-4 w-4" />
                    </span>
                    <div>
                      <a href={`tel:${phone.replace(/\s/g, "")}`} className="font-bold text-gray-900 hover:underline">
                        {phone}
                      </a>
                      <p className="text-[11px] text-gray-500">Toll Free</p>
                    </div>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1560BD] text-white">
                      <Mail className="h-4 w-4" />
                    </span>
                    <a href={`mailto:${email}`} className="font-medium text-gray-900 hover:underline">
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
                  className="absolute right-5 top-16 hidden text-base text-[#0F2557] xl:block"
                  lines={["Happier Homes", "Brighter Lives"]}
                />
              </section>
            </div>
          </div>

          {/* ── Why choose SARA ──────────────────────────────────── */}
          <section aria-labelledby="why-sara">
            <h2 id="why-sara" className="font-heading text-lg font-bold text-gray-900">
              Why Customers Choose SARA
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {WHY_US.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3">
                  <Icon className="h-5 w-5 flex-shrink-0 text-[#1560BD]" strokeWidth={1.6} />
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold leading-tight text-gray-900">{title}</p>
                    <p className="text-[11px] leading-tight text-gray-500">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Closing band ─────────────────────────────────────── */}
          <section className="relative grid overflow-hidden rounded-xl bg-gradient-to-br from-[#0F2557] to-[#071634] lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
            <div className="flex items-center justify-center bg-[#0D2B54]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={storefront} alt="" aria-hidden className="h-full max-h-[240px] w-full object-cover" />
            </div>
            <div className="relative px-6 py-9 text-white sm:px-9">
              <h2 className="font-heading text-2xl font-bold leading-tight sm:text-[28px]">
                From Possibilities
                <br />
                to Partnerships
              </h2>
              <p className="mt-3 text-sm text-white/80">
                Let&apos;s create smarter solutions for a brighter tomorrow.
              </p>
              <Link
                href="/business-enquiries"
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-[#0F2557] transition-transform hover:scale-[1.02]"
              >
                Business Enquiries
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Script
                className="absolute bottom-8 right-8 hidden text-xl text-white xl:block"
                lines={["Happier Homes", "Brighter Lives"]}
              />
            </div>
          </section>

          {/* ── Stats ────────────────────────────────────────────── */}
          <section aria-label="SARA at a glance">
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { icon: Award, value: `${years} Years`, label: "of Trust" },
                { icon: Store, value: stores, label: "Stores Across Karnataka" },
                { icon: Users, value: customers, label: "Happy Customers" },
                { icon: Handshake, value: "Your Trusted", label: "Technology Partner" },
              ].map(({ icon: Icon, value, label }) => (
                <li key={label} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-4">
                  <Icon className="h-6 w-6 flex-shrink-0 text-[#1560BD]" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="font-heading text-[15px] font-bold leading-tight text-gray-900">{value}</p>
                    <p className="text-[11px] leading-tight text-gray-500">{label}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
