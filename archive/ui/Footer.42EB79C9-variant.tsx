"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import useSWR from "swr"
import toast from "react-hot-toast"
import {
  BadgeCheck,
  CreditCard,
  Facebook,
  Headphones,
  Heart,
  Instagram,
  Linkedin,
  Loader2,
  RefreshCw,
  Truck,
  Youtube,
} from "lucide-react"
import { useSettingsData } from "@/hooks/useSettingsData"

type LinkItem = { href: string; label: string }

const SERVICE_LINKS: LinkItem[] = [
  { href: "/track", label: "Track Order" },
  { href: "/cancellation-policy", label: "Returns & Refunds" },
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
  { href: "https://facebook.com", label: "Facebook", icon: Facebook, tint: "bg-[#1877F2]" },
  { href: "https://instagram.com", label: "Instagram", icon: Instagram, tint: "bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]" },
  { href: "https://youtube.com", label: "YouTube", icon: Youtube, tint: "bg-[#FF0000]" },
  { href: "https://linkedin.com", label: "LinkedIn", icon: Linkedin, tint: "bg-[#0A66C2]" },
]

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

const categoriesFetcher = (url: string) => fetch(url).then((res) => (res.ok ? res.json() : []))

function FooterColumn({ title, links }: { title: string; links: LinkItem[] }) {
  return (
    <nav aria-label={title}>
      <h3 className="font-heading text-sm font-bold text-white">{title}</h3>
      <ul className="mt-4 space-y-2">
        {links.map((link, i) => (
          <li key={`${link.href}-${i}`}>
            <Link href={link.href} className="text-[13px] text-slate-400 transition-colors hover:text-white">
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

  const trustItems = [
    { icon: BadgeCheck, title: "100% Genuine Products", subtitle: "Direct from Brands" },
    { icon: CreditCard, title: "Easy EMI", subtitle: "All Major Banks" },
    { icon: RefreshCw, title: "Free Installation", subtitle: "By Certified Engineers" },
    { icon: Truck, title: "Free & Fast Delivery", subtitle: "Across Karnataka" },
    { icon: Headphones, title: "Expert Support", subtitle: phone },
  ]

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
    <footer>
      {/* ── Trust strip (light) ───────────────────────────────────── */}
      <div className="border-t border-brand-border bg-white">
        <div className="section-container">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-5 py-6 sm:grid-cols-3 lg:grid-cols-5">
            {trustItems.map(({ icon: Icon, title, subtitle }) => (
              <li key={title} className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#1560BD]">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-tight text-brand-text-primary">{title}</p>
                  <p className="mt-0.5 text-xs leading-tight text-brand-text-tertiary">{subtitle}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Newsletter band ───────────────────────────────────────── */}
      <div className="bg-[#1560BD] text-white">
        <div className="section-container flex flex-col gap-6 py-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold leading-tight">Get Exclusive Offers &amp; Updates</h2>
            <p className="mt-1 text-sm text-white/80">Subscribe to our newsletter and never miss a deal!</p>
          </div>

          <form onSubmit={handleSubscribe} className="flex w-full max-w-md overflow-hidden rounded-lg bg-white">
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
              className="h-11 flex-1 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={subscribing}
              className="inline-flex h-11 items-center gap-2 bg-[#0D4C99] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0A3E7D] disabled:opacity-70"
            >
              {subscribing && <Loader2 className="h-4 w-4 animate-spin" />}
              Subscribe
            </button>
          </form>

          <div className="flex items-center gap-4">
            <span className="whitespace-nowrap text-sm font-semibold">Follow Us</span>
            <div className="flex items-center gap-4">
              {SOCIALS.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="text-white/90 transition-opacity hover:opacity-70"
                >
                  <Icon size={18} />
                </a>
              ))}
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X"
                className="text-white/90 transition-opacity hover:opacity-70"
              >
                <XIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main columns ──────────────────────────────────────────── */}
      <div className="bg-brand-primary text-white">
        <div className="section-container py-12">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
            {/* Brand */}
            <div className="lg:col-span-4 xl:col-span-3">
              <Link href="/" className="inline-block" aria-label={companyName}>
                {/* The mark is red artwork; inverted to white for the navy footer. */}
                <Image
                  src="/sara-logo.png"
                  alt="SARA"
                  width={374}
                  height={100}
                  className="h-10 w-auto object-contain brightness-0 invert"
                />
                <span className="mt-2 block text-[11px] tracking-wide text-slate-400">
                  Mobiles | Electronics | More
                </span>
              </Link>

              <p className="mt-5 max-w-xs text-[13px] leading-relaxed text-slate-400">
                Your trusted technology partner.
                <br />
                Online. In-store. Always with you.
              </p>

              <div className="mt-6 flex items-center gap-2.5">
                {SOCIALS.map(({ href, label, icon: Icon, tint }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-white transition-transform hover:scale-110 ${tint}`}
                  >
                    <Icon size={15} />
                  </a>
                ))}
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-white transition-transform hover:scale-110"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Link columns */}
            <div className="grid gap-10 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4 xl:col-span-9">
              <FooterColumn title="Shop" links={shopLinks} />
              <FooterColumn title="Customer Service" links={SERVICE_LINKS} />
              <FooterColumn title="About SARA" links={ABOUT_LINKS} />
              <FooterColumn title="Legal" links={LEGAL_LINKS} />
            </div>
          </div>
        </div>

        {/* ── Bottom bar ──────────────────────────────────────────── */}
        <div className="border-t border-white/10">
          <div className="section-container flex flex-col items-center justify-between gap-3 py-4 text-xs text-slate-400 lg:flex-row">
            <span>
              &copy; {new Date().getFullYear()} {legalName}. All rights reserved.
            </span>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <span className="inline-flex items-center gap-1.5">
                Made with <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" /> in India
              </span>
              <span>100% Genuine Products</span>
              <span>Secure Payments</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
