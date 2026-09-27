"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import useSWR from "swr"
import toast from "react-hot-toast"
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  Facebook,
  Headphones,
  Heart,
  Instagram,
  Linkedin,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Store,
  Truck,
  Users,
  Youtube,
} from "lucide-react"
import { useSettingsData } from "@/hooks/useSettingsData"

type LinkItem = { href: string; label: string }

const TRUST_ITEMS = [
  { icon: Truck, title: "Free & Fast Delivery", subtitle: "Across Karnataka" },
  { icon: BadgeCheck, title: "100% Genuine Products", subtitle: "Direct from Brands" },
  { icon: RefreshCw, title: "Easy Exchange & Returns", subtitle: "Hassle Free Shopping" },
  { icon: Headphones, title: "Expert Support", subtitle: null },
]

const SERVICE_LINKS: LinkItem[] = [
  { href: "/track", label: "Track Order" },
  { href: "/cancellation-policy", label: "Returns & Refunds" },
  { href: "/faq#returns", label: "Exchange" },
  { href: "/faq#payment", label: "EMI Options" },
  { href: "/faq#shipping", label: "Shipping Policy" },
  { href: "/faq#warranty", label: "Warranty" },
  { href: "/faq#support", label: "Installation Support" },
  { href: "/faq", label: "Help & FAQs" },
  { href: "/contact", label: "Contact Us" },
]

const ABOUT_LINKS: LinkItem[] = [
  { href: "/about", label: "Our Story" },
  { href: "/stores", label: "Our Stores" },
  { href: "/careers", label: "Careers" },
  { href: "/contact", label: "Business Enquiries" },
  { href: "/press", label: "Press & Media" },
  { href: "/blog", label: "Blog / Buying Guides" },
  { href: "/subham", label: "Corporate Information" },
]

const LEGAL_LINKS: LinkItem[] = [
  { href: "/terms-and-conditions", label: "Terms & Conditions" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/cancellation-policy", label: "Cancellation Policy" },
  { href: "/cancellation-policy", label: "Return Policy" },
  { href: "/faq#shipping", label: "Shipping Policy" },
  { href: "/terms-and-conditions", label: "Disclaimer" },
  { href: "/sitemap.xml", label: "Sitemap" },
]

const SOCIALS = [
  { href: "https://instagram.com", label: "Instagram", icon: Instagram, hover: "hover:bg-[#E1306C]" },
  { href: "https://facebook.com", label: "Facebook", icon: Facebook, hover: "hover:bg-[#1877F2]" },
  { href: "https://youtube.com", label: "YouTube", icon: Youtube, hover: "hover:bg-[#FF0000]" },
  { href: "https://linkedin.com", label: "LinkedIn", icon: Linkedin, hover: "hover:bg-[#0A66C2]" },
]

const STATS = [
  { icon: CalendarClock, value: "25+ Years", label: "of Trust" },
  { icon: Store, value: "85+", label: "Stores Across Karnataka" },
  { icon: Users, value: "2,00,000+", label: "Happy Customers" },
  { icon: ShieldCheck, value: "Your Trusted", label: "Technology Partner" },
]

const PAYMENT_METHODS = ["VISA", "Mastercard", "RuPay", "UPI", "Net Banking"]

const categoriesFetcher = (url: string) => fetch(url).then((res) => (res.ok ? res.json() : []))

function FooterColumn({ title, links }: { title: string; links: LinkItem[] }) {
  return (
    <nav aria-label={title}>
      <h3 className="font-heading text-base font-bold text-white">{title}</h3>
      <ul className="mt-5 space-y-1">
        {links.map((link, i) => (
          <li key={`${link.href}-${i}`}>
            <Link
              href={link.href}
              className="-mx-3 block rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default function Footer() {
  const { data } = useSettingsData()
  const { data: categories } = useSWR<any[]>("/api/categories", categoriesFetcher, {
    revalidateOnFocus: false,
  })

  const [email, setEmail] = useState("")
  const [subscribing, setSubscribing] = useState(false)

  const companyName = data?.storeName || "SARA Mobiles & Electronics"
  const legalName = data?.legalName || companyName
  const phone = data?.storePhone || "1800 123 7272"

  const shopLinks: LinkItem[] = [
    { href: "/products", label: "All Products" },
    ...(Array.isArray(categories) ? categories : [])
      .filter((c: any) => c?.name && !/^test\d*$/i.test(String(c.name)))
      .slice(0, 5)
      .map((c: any) => ({
        href: `/products?category=${encodeURIComponent(c.name)}`,
        label: String(c.name).replace(/\S+/g, (w) => w[0] + w.slice(1).toLowerCase()),
      })),
    { href: "/brands", label: "Brands" },
    { href: "/offers", label: "Offers" },
    { href: "/software", label: "Software" },
    { href: "/rewards", label: "Sara Rewards" },
  ]

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please enter a valid email address")
      return
    }
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
      setSubscribing(false)
    }
  }

  return (
    <footer className="bg-brand-primary text-white">
      {/* ── Trust strip ───────────────────────────────────────────── */}
      <div className="border-b border-white/10 bg-black/20">
        <div className="section-container">
          <ul className="grid grid-cols-1 divide-y divide-white/10 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-white/10">
            {TRUST_ITEMS.map(({ icon: Icon, title, subtitle }) => (
              <li key={title} className="flex items-center gap-3.5 px-4 py-5 lg:justify-center lg:py-6">
                <Icon className="h-7 w-7 flex-shrink-0 text-sky-300" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-semibold leading-tight text-white">{title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {subtitle ?? (
                      <>
                        <a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:text-white">
                          {phone}
                        </a>{" "}
                        Toll Free
                      </>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Main columns ──────────────────────────────────────────── */}
      <div className="section-container py-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Brand + newsletter + socials */}
          <div className="lg:col-span-4 lg:pr-8 xl:col-span-3">
            <Link href="/" className="inline-block" aria-label={companyName}>
              {/* The mark is red artwork; inverted to white for the navy footer. */}
              <Image
                src="/sara-logo.png"
                alt="SARA"
                width={374}
                height={100}
                className="h-12 w-auto object-contain brightness-0 invert"
              />
              <span className="mt-3 block text-sm text-slate-300">Mobiles | Electronics | More</span>
              <svg aria-hidden viewBox="0 0 160 16" className="mt-2 h-3 w-32 text-[#E11D2E]" fill="none">
                <path
                  d="M2 12C34 3 78 2 118 6c14 1.4 28 4 40 7"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </Link>

            <p className="mt-5 font-script text-3xl leading-tight text-white">
              Happier Homes
              <br />
              Brighter Lives
            </p>

            <div className="mt-8">
              <h3 className="font-heading text-base font-bold text-white">Subscribe to Our Updates</h3>
              <p className="mt-1.5 text-sm text-slate-400">
                Get the latest offers, new arrivals and exciting updates.
              </p>
              <form onSubmit={handleSubscribe} className="mt-4 max-w-sm">
                <div className="relative">
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
                    className="h-12 w-full rounded-xl bg-white px-4 pr-14 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <button
                    type="submit"
                    disabled={subscribing}
                    aria-label="Subscribe"
                    className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary text-white transition-colors hover:bg-brand-primary-hover disabled:opacity-60"
                  >
                    {subscribing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </form>
            </div>

            <div className="mt-8">
              <h3 className="font-heading text-base font-bold text-white">Follow Us</h3>
              <div className="mt-4 flex items-center gap-3">
                {SOCIALS.map(({ href, label, icon: Icon, hover }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:scale-110 ${hover}`}
                  >
                    <Icon size={18} />
                  </a>
                ))}
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:scale-110 hover:bg-black"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
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
      <section
        aria-labelledby="footer-story-heading"
        className="relative overflow-hidden border-t border-white/10 bg-black/10"
      >
        {/* Store artwork bleeds off the right edge and fades into the navy */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-[36%] xl:block">
          <StorefrontArt />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-primary via-brand-primary/70 to-transparent" />
        </div>

        <div className="section-container relative py-12 lg:py-14">
          <div className="grid gap-10 lg:grid-cols-2 xl:w-[66%] xl:gap-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">Our Story</p>
              <h2
                id="footer-story-heading"
                className="mt-3 font-heading text-2xl font-bold leading-snug text-white sm:text-3xl"
              >
                From Karnataka,
                <br />
                For a Brighter Tomorrow.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
                What began as a single store has grown into a network trusted across Karnataka — built on
                honest advice, genuine products and service that stays with you long after the sale.
              </p>
              <Link
                href="/about"
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white hover:text-brand-primary"
              >
                Know More
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-8 self-center lg:border-l lg:border-white/10 lg:pl-10">
              {STATS.map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-6 w-6 flex-shrink-0 text-sky-300" strokeWidth={1.5} />
                  <div>
                    <p className="font-heading text-lg font-bold leading-tight text-white">{value}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom bar ────────────────────────────────────────────── */}
      <div className="border-t border-white/10 bg-black/30">
        <div className="section-container flex flex-col items-center justify-between gap-5 py-5 lg:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-slate-400">
            <span>
              &copy; {new Date().getFullYear()} {legalName}. All rights reserved.
            </span>
            <span aria-hidden className="text-white/20">
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
            {PAYMENT_METHODS.map((method) => (
              <li
                key={method}
                className="rounded-md bg-white px-2.5 py-1.5 text-[11px] font-bold tracking-wide text-slate-700"
              >
                {method}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}

/** Placeholder store artwork — replace with a real photograph when one is supplied. */
function StorefrontArt() {
  return (
    <svg viewBox="0 0 480 320" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <defs>
        <linearGradient id="footer-store-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#123055" />
          <stop offset="100%" stopColor="#0B1D38" />
        </linearGradient>
        <linearGradient id="footer-store-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD9A8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFB067" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      <rect width="480" height="320" fill="url(#footer-store-sky)" />

      <rect x="40" y="54" width="400" height="240" rx="10" fill="#0E2748" />
      <rect x="40" y="54" width="400" height="52" rx="10" fill="#0A1A33" />
      <text
        x="240"
        y="90"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Poppins, sans-serif"
        fontSize="30"
        fontWeight="700"
        letterSpacing="4"
      >
        SARA
      </text>
      <rect x="196" y="96" width="88" height="4" rx="2" fill="#E11D2E" />

      <path d="M40 110h400l-26 30H66z" fill="#14315A" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={62 + i * 52} y="110" width="26" height="30" fill="#E11D2E" opacity="0.35" />
      ))}

      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={70 + i * 122}
          y="156"
          width="102"
          height="108"
          rx="6"
          fill="url(#footer-store-glass)"
        />
      ))}
      {[0, 1, 2].map((i) =>
        [0, 1].map((j) => (
          <rect
            key={`${i}-${j}`}
            x={80 + i * 122}
            y={176 + j * 44}
            width="82"
            height="6"
            rx="3"
            fill="#0A1A33"
            opacity="0.55"
          />
        )),
      )}

      <rect x="212" y="212" width="56" height="82" rx="4" fill="#0A1A33" opacity="0.7" />
      <rect y="294" width="480" height="26" fill="#081527" />
    </svg>
  )
}
