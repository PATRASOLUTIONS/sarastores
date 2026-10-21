"use client"

import Link from "next/link"
import Image from "next/image"
import { useRef, useState, type ElementType, type FormEvent } from "react"
import { Facebook, Globe, Heart, Instagram, Linkedin, Loader2, Youtube } from "lucide-react"
import toast from "react-hot-toast"
import CookiePreferencesLink from "@/components/CookiePreferencesLink"
import { useSettingsData } from "@/hooks/useSettingsData"
import styles from "./Footer.module.css"
import { useMarketingContent } from "@/hooks/useMarketingContent"
import { MarketingSection, MarketingSections, MarketingStatus } from "@/components/marketing/MarketingSections"

type LinkItem = { href: string; label: string }

const SHOP_LINKS: LinkItem[] = [
  { href: "/products?q=mobile", label: "Mobiles" },
  { href: "/products", label: "Electronics" },
  { href: "/products?q=laptop", label: "Computers" },
  { href: "/products?q=audio", label: "Audio" },
  { href: "/products?q=watch", label: "Wearables" },
  { href: "/products?q=accessories", label: "Accessories" },
  { href: "/offers", label: "Offers" },
  { href: "/products", label: "New Arrivals" },
  { href: "/brands", label: "Brands" },
]

const SERVICE_LINKS: LinkItem[] = [
  { href: "/track", label: "Track Order" },
  { href: "/returns", label: "Returns & Refunds" },
  { href: "/contact", label: "Exchange" },
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
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/account/privacy", label: "Privacy & My Data" },
  { href: "/cancellation-policy", label: "Cancellation Policy" },
  { href: "/returns", label: "Return Policy" },
  { href: "/shipping-policy", label: "Shipping Policy" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/sitemap", label: "Sitemap" },
]

function XIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
}

const SOCIALS: Array<{
  key: string
  label: string
  icon: ElementType
  tint: string
  fallbackHref?: string
}> = [
  { key: "websiteUrl", label: "Official website", icon: Globe, tint: "#1560bd", fallbackHref: "https://www.sarastores.com/" },
  { key: "facebookUrl", label: "Facebook", icon: Facebook, tint: "#295caf" },
  { key: "instagramUrl", label: "Instagram", icon: Instagram, tint: "#a44b9c", fallbackHref: "https://www.instagram.com/saramobilesandelectronics/" },
  { key: "youtubeUrl", label: "YouTube", icon: Youtube, tint: "#ff0000" },
  { key: "linkedinUrl", label: "LinkedIn", icon: Linkedin, tint: "#007bb5", fallbackHref: "https://www.linkedin.com/company/sara-mobiles-electronics" },
  { key: "xUrl", label: "X", icon: XIcon, tint: "#000000" },
]

function FooterColumn({ title, links, legal = false }: { title: string; links: LinkItem[]; legal?: boolean }) {
  return (
    <nav className={styles.column} aria-label={title}>
      <h3>{title}</h3>
      <ul>
        {links.map((link) => <li key={`${link.href}-${link.label}`}><Link href={link.href}>{link.label}</Link></li>)}
        {legal && <li><CookiePreferencesLink className={styles.cookieLink} /></li>}
      </ul>
    </nav>
  )
}

export default function Footer() {
  const marketing = useMarketingContent("footer")
  const linksFor = (section: string, links: LinkItem[]) => marketing.items(section, links.map(item => ({ ...item, title: item.label })))
    .map(item => ({ href: item.href, label: item.title }))
  const { data } = useSettingsData()
  const settings = data as Record<string, unknown> | undefined
  const settingUrl = (key: string) => {
    const value = settings?.[key]
    return typeof value === "string" && /^https?:\/\//i.test(value.trim()) ? value.trim() : undefined
  }
  const socials = SOCIALS.map((social) => ({
    ...social,
    href: settingUrl(social.key) || social.fallbackHref || (social.key === "xUrl" ? settingUrl("twitterUrl") : undefined),
  }))
  const [email, setEmail] = useState("")
  const [subscribing, setSubscribing] = useState(false)
  const [subscriptionMessage, setSubscriptionMessage] = useState("")
  const [subscriptionError, setSubscriptionError] = useState(false)
  const subscribeLock = useRef(false)
  const companyName = typeof settings?.storeName === "string" ? settings.storeName : "SARA Mobiles & Electronics"
  const legalName = typeof settings?.legalName === "string" ? settings.legalName : companyName

  const handleSubscribe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (subscribeLock.current) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please enter a valid email address")
      return
    }
    subscribeLock.current = true
    setSubscriptionMessage("")
    setSubscriptionError(false)
    setSubscribing(true)
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "Footer newsletter" }),
      })
      const json: unknown = await response.json()
      const result = typeof json === "object" && json !== null ? json as Record<string, unknown> : undefined
      if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "Could not subscribe right now")
      if (result?.success !== true) throw new Error("Could not confirm your subscription. Please try again.")
      setEmail("")
      const message = typeof result?.message === "string" ? result.message : "You're subscribed!"
      setSubscriptionMessage(message)
      toast.success(message)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not subscribe right now"
      setSubscriptionError(true)
      setSubscriptionMessage(message)
      toast.error(message)
    } finally {
      subscribeLock.current = false
      setSubscribing(false)
    }
  }

  const socialLinks = (compact: boolean) => socials.map(({ href, label, icon: Icon, tint }) => {
    const className = compact ? styles.stripSocial : styles.socialCircle
    const style = compact ? undefined : { background: tint }
    return href
      ? <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={className} style={style}><Icon className={styles.socialIcon} aria-hidden /></a>
      : <span role="img" key={label} title={`${label} link not configured`} aria-label={`${label} link not configured`} className={`${className} ${styles.unconfiguredSocial}`} style={style}><Icon className={styles.socialIcon} aria-hidden /></span>
  })

  return (
    <footer className={styles.footer}>
      <MarketingStatus page="footer" />
      <MarketingSection page="footer" section="newsletter">
      <section className={styles.newsletter} aria-labelledby="footer-newsletter-heading">
        <div className={styles.newsletterInner}>
          <div className={styles.newsletterCopy}>
            <h2 id="footer-newsletter-heading">{marketing.text("newsletter", "title")}</h2>
            <p>{marketing.text("newsletter", "description")}</p>
          </div>
          <form onSubmit={handleSubscribe} className={styles.subscribeForm}>
            <label htmlFor="footer-newsletter" className="sr-only">Email address</label>
            <input id="footer-newsletter" name="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email address" autoComplete="email" />
            <button type="submit" disabled={subscribing}>{subscribing ? <><Loader2 size={14} className="animate-spin" aria-hidden /> Subscribing</> : marketing.text("newsletter", "ctaText")}</button>
          </form>
          {subscriptionMessage && <p className={styles.subscriptionStatus} role={subscriptionError ? "alert" : "status"}>{subscriptionMessage}</p>}
          <div className={styles.follow}><span>{marketing.text("newsletter", "followTitle")}</span><div>{socialLinks(true)}</div></div>
        </div>
      </section>
      </MarketingSection>

      <div className={styles.container}>
        <div className={styles.columns}>
          <MarketingSections page="footer" showStatus={false}>
          <MarketingSection page="footer" section="brand">
          <div className={styles.brand}>
            <Link href={marketing.text("brand", "ctaLink")} aria-label={companyName} className={styles.logo}>
              <Image src={marketing.text("brand", "image")} alt="SARA" width={374} height={100} unoptimized />
            </Link>
            <p className={styles.tagline}>{marketing.text("brand", "tagline")}</p>
            <p className={`${styles.brandCopy} whitespace-pre-line`}>{marketing.text("brand", "description")}</p>
            <div className={styles.brandSocials}>{socialLinks(false)}</div>
          </div>
          </MarketingSection>
          <MarketingSection page="footer" section="shop"><FooterColumn title={marketing.text("shop", "title")} links={linksFor("shop", SHOP_LINKS)} /></MarketingSection>
          <MarketingSection page="footer" section="service"><FooterColumn title={marketing.text("service", "title")} links={linksFor("service", SERVICE_LINKS)} /></MarketingSection>
          <MarketingSection page="footer" section="about"><FooterColumn title={marketing.text("about", "title")} links={linksFor("about", ABOUT_LINKS)} /></MarketingSection>
          <MarketingSection page="footer" section="legal"><FooterColumn title={marketing.text("legal", "title")} links={linksFor("legal", LEGAL_LINKS)} legal /></MarketingSection>
          </MarketingSections>
        </div>
        {!marketing.enabled("legal") && <CookiePreferencesLink className={styles.cookieLink} />}
        <div className={styles.bottom}>
          <p>&copy; {new Date().getFullYear()} {legalName.replace(/\.\s*$/, "")}. All rights reserved.</p>
          <div><span>Built by <a href="https://bytewiseconsulting.in" target="_blank" rel="noopener noreferrer">Bytewise Consulting LLP</a></span><span>Made with <Heart size={10} fill="#ef4444" color="#ef4444" aria-label="love" /> in India</span>{marketing.enabled("bottom") && <><span>{marketing.text("bottom", "paymentTitle")}</span><span>{marketing.text("bottom", "genuineTitle")}</span></>}</div>
        </div>
      </div>
    </footer>
  )
}
