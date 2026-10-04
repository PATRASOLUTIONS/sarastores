"use client"

import Link from "next/link"
import Image from "next/image"
import { useRef, useState } from "react"
import useSWR from "swr"
import toast from "react-hot-toast"
import CookiePreferencesLink from "@/components/CookiePreferencesLink"
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Facebook,
  Gem,
  Headphones,
  Heart,
  Instagram,
  Linkedin,
  Loader2,
  RefreshCw,
  Store,
  Truck,
  Users,
} from "lucide-react"
import { useSettingsData } from "@/hooks/useSettingsData"
import { useBrandImages } from "@/hooks/useBrandImages"
import { titleCaseLabel } from "@/lib/product-display"

type LinkItem = { href: string; label: string }

const SERVICE_LINKS: LinkItem[] = [
  { href: "/track", label: "Track Order" },
  { href: "/returns", label: "Returns & Refunds" },
  { href: "/emi", label: "EMI Options" },
  { href: "/shipping-policy", label: "Shipping Policy" },
  { href: "/warranty", label: "Warranty" },
  { href: "/installation", label: "Installation Support" },
  { href: "/faq", label: "Help & FAQs" },
  { href: "/contact", label: "Contact Us" },
]

const ABOUT_LINKS: LinkItem[] = [
  { href: "/about", label: "Our Story" },
  { href: "/stores", label: "Our Stores" },
  { href: "/careers", label: "Careers" },
  { href: "/business-enquiries", label: "Business Enquiries" },
  { href: "/press", label: "Press & Media" },
  { href: "/blog", label: "Blog / Buying Guides" },
  { href: "/corporate-information", label: "Corporate Information" },
]

const LEGAL_LINKS: LinkItem[] = [
  { href: "/terms-and-conditions", label: "Terms & Conditions" },
  { href: "/privacy-policy", label: "Privacy Notice" },
  { href: "/account/privacy", label: "Privacy & My Data" },
  { href: "/cancellation-policy", label: "Cancellation Policy" },
  { href: "/returns", label: "Return Policy" },
  { href: "/shipping-policy", label: "Shipping Policy" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/sitemap", label: "Sitemap" },
]

// Hrefs come from site settings; a platform is hidden until its URL is configured,
// because a link to the bare platform homepage is worse than no link at all.
const SOCIALS = [
  {
    settingsKey: "instagramUrl",
    label: "Instagram",
    icon: Instagram,
    tint: "bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
  },
  { settingsKey: "facebookUrl", label: "Facebook", icon: Facebook, tint: "bg-[#1877F2]" },
  { settingsKey: "youtubeUrl", label: "YouTube", icon: Youtube, tint: "bg-[#FF0000]" },
  { settingsKey: "linkedinUrl", label: "LinkedIn", icon: Linkedin, tint: "bg-[#0A66C2]" },
]

const PAYMENT_METHODS = [
  { label: "VISA", className: "text-[#1A1F71] italic" },
  { label: "Mastercard", className: "text-[#EB001B]" },
  { label: "RuPay", className: "text-[#097C3B]" },
  { label: "UPI", className: "text-[#5B2D8E]" },
  { label: "Net Banking", className: "text-slate-700" },
]

function Youtube(props: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={props.size ?? 24} height={props.size ?? 24} aria-hidden>
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8zM9.6 15.6V8.4L15.8 12z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

const categoriesFetcher = (url: string) => fetch(url).then((res) => (res.ok ? res.json() : []))

function FooterColumn({ title, links }: { title: string; links: LinkItem[] }) {
  const linkClass =
    "-mx-3 block rounded-md px-3 py-1.5 text-left text-[13px] text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
  return (
    <nav aria-label={title}>
      <h3 className="font-heading text-[15px] font-bold text-white">{title}</h3>
      <ul className="mt-4 space-y-0.5">
        {links.map((link, i) => (
          <li key={`${link.href}-${i}`}>
            <Link href={link.href} className={linkClass}>
              {link.label}
            </Link>
          </li>
        ))}
        {title === "Legal" && (
          <li>
            <CookiePreferencesLink className={`${linkClass} w-full`} />
          </li>
        )}
      </ul>
    </nav>
  )
}

export default function Footer() {
  const { data } = useSettingsData()
  const { storefront } = useBrandImages()
  const { data: subCategories } = useSWR<any[]>("/api/sub-categories", categoriesFetcher, {
    revalidateOnFocus: false,
  })

  const socialUrl = (key: string) => {
    const value = (data as Record<string, unknown> | undefined)?.[key]
    return typeof value === "string" && /^https?:\/\//i.test(value.trim()) ? value.trim() : null
  }
  const activeSocials = SOCIALS.map((social) => ({ ...social, href: socialUrl(social.settingsKey) })).filter(
    (social): social is typeof social & { href: string } => Boolean(social.href),
  )
  const xUrl = socialUrl("xUrl") || socialUrl("twitterUrl")

  const [email, setEmail] = useState("")
  const subscribeLock = useRef(false)
  const [subscribing, setSubscribing] = useState(false)

  const companyName = data?.storeName || "SARA Mobiles & Electronics"
  const legalName = data?.legalName || companyName
  const phone = data?.storePhone || "1800 123 7272"

  const years = data?.statYears || "25+"
  const storeCount = data?.statStores || "85+"
  const customers = data?.statCustomers || "2,00,000+"

  const shopLinks: LinkItem[] = [
    ...(Array.isArray(subCategories) ? subCategories : [])
      .filter((s: any) => s?.name && s?.active !== false && !/^test\d*$/i.test(String(s.name)))
      .slice(0, 6)
      .map((s: any) => ({
        href: `/products?subCategory=${encodeURIComponent(s.name)}`,
        label: titleCaseLabel(String(s.name)),
      })),
    { href: "/brands", label: "Brands" },
    { href: "/offers", label: "Offers" },
    { href: "/products", label: "New Arrivals" },
  ]

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    // Ref, not state: `disabled` only applies after a re-render, so a fast
    // double click would otherwise fire the request twice.
    if (subscribeLock.current) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please enter a valid email address")
      return
    }
    subscribeLock.current = true
    setSubscribing(true)
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "Footer newsletter" }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not subscribe right now")
      setEmail("")
      toast.success(json.message || "You're subscribed!")
    } catch (err: any) {
      toast.error(err.message || "Could not subscribe right now")
    } finally {
      subscribeLock.current = false
      setSubscribing(false)
    }
  }

  const trustItems = [
    { icon: Truck, title: "Free & Fast Delivery", subtitle: "Across Karnataka" },
    { icon: BadgeCheck, title: "100% Genuine Products", subtitle: "Direct from Brands" },
    { icon: RefreshCw, title: "Easy Returns & Refunds", subtitle: "Hassle Free Shopping" },
    { icon: Headphones, title: "Expert Support", subtitle: `${phone} (Toll Free)` },
  ]

  const stats = [
    { icon: Users, value: `${years} Years`, label: "of Trust" },
    { icon: Store, value: storeCount, label: "Stores Across Karnataka" },
    { icon: Users, value: customers, label: "Happy Customers" },
    { icon: Gem, value: "Your Trusted", label: "Technology Partner" },
  ]

  return (
    <footer className="bg-[#0B1B33] text-white">
      {/* ── Trust strip ───────────────────────────────────────────── */}
      <div className="border-b border-white/10 bg-[#0A1830]">
        <div className="section-container">
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-white/12">
            {trustItems.map(({ icon: Icon, title, subtitle }) => (
              <li key={title} className="flex items-center gap-4 px-2 py-5 lg:justify-center lg:px-5">
                <Icon className="h-8 w-8 flex-shrink-0 text-[#7FB3F0]" strokeWidth={1.4} />
                <div>
                  <p className="text-[15px] font-bold leading-tight text-white">{title}</p>
                  <p className="mt-0.5 text-[13px] text-slate-400">{subtitle}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Main columns ──────────────────────────────────────────── */}
      <div className="section-container py-12">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-6">
          {/* Brand, newsletter, socials */}
          <div className="lg:col-span-4 xl:col-span-3">
            <Link href="/" className="inline-block" aria-label={companyName}>
              {/* The mark is red artwork; inverted to white for the navy footer. */}
              <Image
                src="/sara-logo.png"
                alt="SARA"
                width={374}
                height={100}
                className="h-14 w-auto object-contain brightness-0 invert"
                priority={false}
              />
            </Link>
            <p className="mt-1 text-[13px] text-slate-300">Mobiles | Electronics | More</p>
            <svg aria-hidden viewBox="0 0 160 16" className="mt-1 h-3 w-28 text-[#E11D2E]" fill="none">
              <path
                d="M2 12C34 3 78 2 118 6c14 1.4 28 4 40 7"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>

            <p className="mt-4 font-script text-[26px] leading-[1.15] text-white">
              Happier Homes
              <br />
              <span className="ml-4">Brighter Lives</span>
            </p>

            <div className="mt-8">
              <h3 className="font-heading text-[15px] font-bold text-white">Subscribe to Our Updates</h3>
              <p className="mt-1.5 max-w-[260px] text-[13px] leading-relaxed text-slate-400">
                Get the latest offers, new arrivals and exciting updates.
              </p>
              <form onSubmit={handleSubscribe} className="mt-4 flex max-w-[290px] overflow-hidden rounded-md bg-white">
                <label htmlFor="footer-newsletter" className="sr-only">
                  Email address
                </label>
                <input
                  id="footer-newsletter"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  autoComplete="email"
                  className="h-11 flex-1 px-3.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={subscribing}
                  aria-label="Subscribe"
                  className="flex h-11 w-12 items-center justify-center bg-[#1560BD] text-white transition-colors hover:bg-[#0D4C99] disabled:opacity-60"
                >
                  {subscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                </button>
              </form>
            </div>

            <div className={`mt-8 ${activeSocials.length === 0 ? "hidden" : ""}`}>
              <h3 className="font-heading text-[15px] font-bold text-white">Follow Us</h3>
              <div className="mt-3.5 flex items-center gap-3">
                {activeSocials.map(({ href, label, icon: Icon, tint }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform hover:scale-110 ${tint}`}
                  >
                    <Icon size={17} />
                  </a>
                ))}
                {xUrl && (
                  <a
                    href={xUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="X"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white transition-transform hover:scale-110"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid gap-10 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4 lg:gap-0 xl:col-span-9">
            <div className="lg:border-l lg:border-white/10 lg:pl-6">
              <FooterColumn title="Shop" links={shopLinks} />
            </div>
            <div className="lg:border-l lg:border-white/10 lg:pl-6">
              <FooterColumn title="Customer Service" links={SERVICE_LINKS} />
            </div>
            <div className="lg:border-l lg:border-white/10 lg:pl-6">
              <FooterColumn title="About SARA" links={ABOUT_LINKS} />
            </div>
            <div className="lg:border-l lg:border-white/10 lg:pl-6">
              <FooterColumn title="Legal" links={LEGAL_LINKS} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Our Story band ────────────────────────────────────────── */}
      <section aria-labelledby="footer-story-heading" className="relative overflow-hidden border-t border-white/10">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-[38%] xl:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={storefront} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B1B33] via-[#0B1B33]/70 to-transparent" />
          <p className="absolute right-5 top-7 font-script text-lg leading-tight text-white">
            Happier
            <br />
            Homes
            <br />
            Brighter
            <br />
            Lives
            <svg viewBox="0 0 100 12" className="mt-1 h-2 w-20" fill="none" aria-hidden>
              <path d="M2 9C22 3 54 2 74 4c8 .8 16 2.6 24 5" stroke="#E11D2E" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </p>
        </div>

        <div className="section-container relative py-11">
          <div className="grid gap-10 lg:grid-cols-2 xl:w-[64%] xl:gap-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">Our Story</p>
              <h2
                id="footer-story-heading"
                className="mt-3 font-heading text-[26px] font-bold leading-[1.15] text-white sm:text-[30px]"
              >
                From Karnataka,
                <br />
                For a Brighter Tomorrow.
              </h2>
              <p className="mt-4 max-w-lg text-[13px] leading-relaxed text-slate-400">
                What started as a single store over {years.replace(/\D/g, "")} years ago, SARA has grown into{" "}
                {storeCount} stores across Karnataka, serving over {customers} happy customers. We are driven by a
                simple belief — everyone deserves access to the best technology for a brighter, smarter life.
              </p>
              <Link
                href="/about"
                className="mt-6 inline-flex items-center gap-2 rounded-md border border-white/25 px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:border-white hover:bg-white hover:text-[#0B1B33]"
              >
                Know More
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-x-5 gap-y-8 self-center sm:grid-cols-4 lg:border-l lg:border-white/10 lg:pl-8">
              {stats.map(({ icon: Icon, value, label }) => (
                <div key={label} className="text-center">
                  <Icon className="mx-auto h-7 w-7 text-white" strokeWidth={1.4} />
                  <p className="mt-2.5 font-heading text-[15px] font-bold leading-tight text-white">{value}</p>
                  <p className="mt-0.5 text-[12px] leading-tight text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom bar ────────────────────────────────────────────── */}
      <div className="border-t border-white/10 bg-[#0A1830]">
        <div className="section-container flex flex-col items-center justify-between gap-4 py-4 lg:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] text-slate-400">
            <span>
              &copy; {new Date().getFullYear()} {legalName.replace(/\.\s*$/, "")}. All rights reserved.
            </span>
            <span aria-hidden className="hidden text-white/20 lg:inline">
              |
            </span>
            <span className="inline-flex items-center gap-1.5">
              Made with <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" /> in India
            </span>
            <span aria-hidden className="text-white/20">
              |
            </span>
            <span>100% Genuine Products</span>
            <span aria-hidden className="text-white/20">
              |
            </span>
            <span>Secure Payments</span>
          </div>

          <ul className="flex flex-wrap items-center justify-center gap-2">
            {PAYMENT_METHODS.map(({ label, className }) => (
              <li
                key={label}
                className={`rounded bg-white px-2.5 py-1.5 text-[11px] font-extrabold tracking-tight ${className}`}
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
