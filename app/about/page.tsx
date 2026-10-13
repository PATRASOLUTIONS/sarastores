"use client"

import Link from "next/link"
import { ArrowRight, Award, CheckCircle2, ChevronRight, CreditCard, Diamond, Eye, Handshake, Headphones, Heart, MapPin, Settings, ShieldCheck, Store, Target, Users } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { useSettingsData } from "@/hooks/useSettingsData"
import styles from "./about.module.css"
import { useMarketingContent } from "@/hooks/useMarketingContent"
import { MarketingSection, MarketingSections } from "@/components/marketing/MarketingSections"

const PROMISES = [
  { icon: Heart, title: "Customer", detail: "First" },
  { icon: Users, title: "People", detail: "Driven" },
  { icon: Settings, title: "Always", detail: "Innovating" },
  { icon: Handshake, title: "Growing", detail: "Together" },
]

const VALUES = [
  "Trust & Transparency", "Innovation & Adaptability",
  "Customer Delight", "Respect for People",
  "Integrity in Business", "Commitment to Community",
]

const JOURNEY = [
  { marker: "Our Roots", label: "Electronics retail", detail: "In Karnataka" },
  { marker: "Our Reach", label: "Stores across", detail: "Multiple cities" },
  { marker: "Our Range", label: "Multi-brand", detail: "Technology & appliances" },
  { marker: "Our Approach", label: "Expert guidance", detail: "In-store & online" },
  { marker: "Our Community", label: "Customers at", detail: "The heart of SARA" },
  { marker: "Today", label: "Shop online", detail: "Or visit a store" },
  { marker: "Beyond", label: "A brighter", detail: "Tomorrow" },
]

function configuredText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

export default function AboutPage() {
  const marketing = useMarketingContent("about")
  const { data, error, isLoading } = useSettingsData()
  const years = configuredText(data?.statYears)
  const stores = configuredText(data?.statStores)
  const customers = configuredText(data?.statCustomers)
  const displayStat = (value: string | undefined) => value || (isLoading ? "..." : "Not specified")
  const stats = marketing.items("stats", [
    { icon: Store, value: displayStat(stores), label: "Stores Across", detail: "Karnataka" },
    { icon: Users, value: displayStat(customers), label: "Happy Customers", detail: "" },
    { icon: Diamond, value: displayStat(years), label: "Years of Trust", detail: "" },
    { icon: Award, value: marketing.text("stats", "item4Value"), label: "From Top Brands", detail: "" },
    { icon: MapPin, value: marketing.text("stats", "item5Value"), label: "Presence", detail: "Across Cities" },
  ].map(item => ({ ...item, title: item.label })))
  const trust = marketing.items("services", [
    { icon: CreditCard, title: "Easy EMI Options", detail: "Available at Checkout", href: "/emi" },
    { icon: ShieldCheck, title: "Warranty Support", detail: "& After-Sales Assistance", href: "/warranty" },
    { icon: Headphones, title: "Expert Assistance", detail: "In-Store & Online", href: "/contact" },
    { icon: MapPin, title: `${stores ? `${stores} ` : ""}Stores`, detail: "Across Karnataka", href: "/store-locator" },
  ])
  const promises = marketing.items("story", PROMISES)

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.container}>
        {!marketing.enabled("hero") && <h1 className="sr-only">About SARA</h1>}
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Home</Link><ChevronRight size={12} /><span>About SARA</span>
        </nav>
        <MarketingSections page="about">
        <MarketingSection page="about" section="hero">
        <section className={styles.hero} aria-labelledby="about-hero-heading">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={marketing.image("hero", "image", configuredText(data?.storefrontImage) || "/about/store-hero.webp")} alt="SARA electronics showroom" className={styles.heroImage} />
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>{marketing.text("hero", "eyebrow")}</p>
            <h1 id="about-hero-heading" className="font-heading whitespace-pre-line">{marketing.text("hero", "title")}</h1>
            <p className={styles.heroDescription}>
              {years ? `For ${years} years, ` : ""}{marketing.text("hero", "description")}
            </p>
            <Link href={marketing.text("hero", "ctaLink")} className={styles.primaryButton}>{marketing.text("hero", "ctaText")} <ArrowRight size={14} /></Link>
          </div>
        </section>
        </MarketingSection>
        {error && <p role="alert" className={styles.dataError}>Company figures are temporarily unavailable. Please refresh to try again.</p>}
        <MarketingSection page="about" section="stats">
        <section className={styles.stats} aria-label="SARA at a glance">
          <ul>{stats.map(({ icon: Icon, value, title, detail }) => <li key={title}>
            <Icon strokeWidth={1.6} /><div><strong>{value}</strong><p>{title}</p>{detail && <p>{detail}</p>}</div>
          </li>)}</ul>
        </section>
        </MarketingSection>
        <MarketingSection page="about" section="story">
        <section className={styles.story} aria-labelledby="our-story">
          <div className={styles.storyCopy}>
            <h2 id="our-story" className={styles.sectionHeading}>{marketing.text("story", "title")}</h2>
            <p>
              {marketing.text("story", "description")}
            </p>
            <p>
              {marketing.text("story", "secondParagraph")}
            </p>
            <Link href={marketing.text("story", "ctaLink")} className={styles.outlineButton}>{marketing.text("story", "ctaText")} <ArrowRight size={14} /></Link>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={marketing.image("story", "image", configuredText(data?.lifestyleImage) || "/about/family-technology.webp")} alt="A family enjoying technology together" className={styles.familyImage} />
          <ul className={styles.promises}>{promises.map(({ icon: Icon, title, detail }) => <li key={title}>
            <Icon strokeWidth={1.6} /><p>{title}<br />{detail}</p>
          </li>)}</ul>
        </section>
        </MarketingSection>
        <MarketingSection page="about" section="purpose">
        <section className={styles.purpose} aria-label="Our vision, mission and values">
          <div className={styles.purposeCard}>
            <Eye strokeWidth={1.6} /><div><h2>{marketing.text("purpose", "visionTitle")}</h2><p>{marketing.text("purpose", "visionDescription")}</p></div>
          </div>
          <div className={styles.purposeCard}>
            <Target strokeWidth={1.6} /><div><h2>{marketing.text("purpose", "missionTitle")}</h2><p>{marketing.text("purpose", "missionDescription")}</p></div>
          </div>
          <div className={styles.values}>
            <div className={styles.valuesHeading}><Diamond strokeWidth={1.6} /><h2>{marketing.text("purpose", "valuesTitle")}</h2></div>
            <ul>{VALUES.map((value, index) => <li key={index}><CheckCircle2 size={12} /><span>{marketing.text("purpose", `item${index + 1}Title`, value)}</span></li>)}</ul>
          </div>
        </section>
        </MarketingSection>
        <MarketingSection page="about" section="journey">
        <section id="our-journey" className={styles.journey} aria-labelledby="journey-heading">
          <h2 id="journey-heading" className={styles.sectionHeading}>{marketing.text("journey", "title")}</h2>
          <ol>{JOURNEY.map(({ marker, label, detail }, index) => <li key={index}>
            <strong>{marketing.text("journey", `item${index + 1}Marker`, marker)}</strong><span className={styles.timelineDot} /><p>{marketing.text("journey", `item${index + 1}Title`, label)}<br />{marketing.text("journey", `item${index + 1}Detail`, detail)}</p>
          </li>)}</ol>
          <Link className={styles.timelineArrow} href="/products" aria-label="Explore SARA products"><ArrowRight size={16} /></Link>
        </section>
        </MarketingSection>
        <MarketingSection page="about" section="statement">
        <section className={styles.statement} aria-labelledby="statement-heading">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={marketing.text("statement", "image")} alt="Electronics and mobile displays inside a SARA showroom" className={styles.statementImage} />
          <div className={styles.statementContent}>
            <h2 id="statement-heading" className="whitespace-pre-line">{marketing.text("statement", "title")}</h2>
            <p>{marketing.text("statement", "description")}</p>
            <Link href={marketing.text("statement", "ctaLink")} className={styles.lightButton}>{marketing.text("statement", "ctaText")} <ArrowRight size={14} /></Link>
          </div>
        </section>
        </MarketingSection>
        <MarketingSection page="about" section="services">
        <section className={styles.trust} aria-label="Why shop at SARA">
          <ul>{trust.map(({ icon: Icon, title, detail, href }) => <li key={title}><Link href={href}>
            <Icon strokeWidth={1.6} /><div><strong>{title}</strong><p>{detail}</p></div>
          </Link></li>)}</ul>
        </section>
        </MarketingSection>
        </MarketingSections>
      </main>
      <Footer />
    </div>
  )
}
