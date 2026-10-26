"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FaApple } from "react-icons/fa"
import { ArrowRight, BatteryCharging, Camera, ChevronLeft, ChevronRight, Cpu, Smartphone } from "lucide-react"
import { bannerGradient, bannerIsPhotoOnly, useBanners, type SiteBanner } from "@/hooks/useBanners"
import type { HomeProduct } from "./HomepageSections"
import styles from "./homepage.module.css"

const ICONS = [Cpu, Smartphone, Camera, BatteryCharging]

export default function LandingHero({ products = [], sideBanners = [], previewBanners }: { products?: HomeProduct[]; sideBanners?: SiteBanner[]; previewBanners?: SiteBanner[] }) {
  const banners = useBanners("home-hero")
  const slides = previewBanners ?? banners
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const current = Math.min(index, slides.length - 1)
  const slide = slides[current]
  const isIphone = !!slide && /iphone\s*16/i.test(slide.title)
  const iphone = products.filter((product) => /iphone\s*16\b/i.test(product.name) && product.stock > 0).sort((a, b) => a.price - b.price)[0]

  useEffect(() => {
    if (slides.length < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = setInterval(() => setIndex((value) => (value + 1) % slides.length), 7000)
    return () => clearInterval(timer)
  }, [slides.length, paused])

  const go = (step: number) => setIndex((current + step + slides.length) % slides.length)

  const pairedSideBanners = sideBanners.length >= 2 ? sideBanners.slice(0, 2) : []
  const photoHero = !!slide && bannerIsPhotoOnly(slide)
  if (!slide && pairedSideBanners.length === 0) return null

  return (
    <section className={`${styles.heroGrid} ${!slide || pairedSideBanners.length === 0 || photoHero ? styles.heroSingle : ""}`} aria-label="Featured offers">
      {slide && <div className={styles.hero} style={photoHero ? undefined : { ...bannerGradient(slide), color: slide.dark ? "var(--brand-text-primary)" : "#fff" }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }} aria-roledescription={slides.length > 1 ? "carousel" : undefined}>
        {photoHero ? (
          slide.ctaLink ? <Link href={slide.ctaLink} className={styles.heroPhotoLink}><img src={slide.image} alt="" className={styles.heroPhoto} fetchPriority="high" /></Link> : <img src={slide.image} alt="" className={styles.heroPhoto} fetchPriority="high" />
        ) : slide.image && <img src={slide.image} alt="" className={styles.heroArt} fetchPriority="high" />}
        {!photoHero && <div className={styles.heroCopy}>
          <div className={styles.heroTitle}>
            {isIphone && <FaApple className={styles.appleMark} aria-hidden />}
            <h1 style={{ whiteSpace: "pre-line" }}>{slide.title}</h1>
          </div>
          {slide.subtitle && <p className={styles.heroSubtitle}>{slide.subtitle}</p>}
          {slide.bullets?.length ? <ul className={styles.heroFeatures}>
            {slide.bullets.slice(0, 4).map((text, i) => {
              const Icon = ICONS[i]
              return <li key={text}><Icon size={20} strokeWidth={1.4} aria-hidden /><span style={{ whiteSpace: "pre-line" }}>{text}</span></li>
            })}
          </ul> : null}
          {isIphone && iphone && <p className={styles.heroPrice}>From ₹{iphone.price.toLocaleString("en-IN")}</p>}
          {slide.ctaText && <Link href={slide.ctaLink || "/products"} className={styles.shopButton}>{slide.ctaText} <ArrowRight size={14} aria-hidden /></Link>}
        </div>}
        {slides.length > 1 && <>
          <button type="button" className={`${styles.slideArrow} ${styles.previous}`} onClick={() => go(-1)} aria-label="Previous slide"><ChevronLeft size={20} /></button>
          <button type="button" className={`${styles.slideArrow} ${styles.next}`} onClick={() => go(1)} aria-label="Next slide"><ChevronRight size={20} /></button>
          <div className={styles.slideDots}>{slides.map((item, i) => <button key={item.id} type="button" onClick={() => setIndex(i)} aria-label={`Show slide ${i + 1}: ${item.title}`} aria-current={i === current} />)}</div>
        </>}
      </div>}
      {!photoHero && pairedSideBanners.length > 0 && <div className={styles.heroSide} style={{ gridTemplateRows: `repeat(${pairedSideBanners.length}, minmax(0, 1fr))` }}>
        {pairedSideBanners.map((banner) => {
          const photo = bannerIsPhotoOnly(banner)
          return <article key={banner.id} className={styles.sideCard} style={photo ? undefined : { ...bannerGradient(banner), color: banner.dark ? "var(--brand-text-primary)" : "#fff" }}>
            {photo ? (
              banner.ctaLink ? <Link href={banner.ctaLink} className={styles.heroPhotoLink}><img src={banner.image} alt="" className={styles.heroPhoto} fetchPriority="high" /></Link> : <img src={banner.image} alt="" className={styles.heroPhoto} fetchPriority="high" />
            ) : banner.image && <img src={banner.image} alt="" className={styles.sideImage} fetchPriority="high" />}
            {!photo && <div className={styles.sideCopy}>
              <h2 style={{ whiteSpace: "pre-line" }}>{banner.title}</h2>
              {banner.subtitle && <p>{banner.subtitle}</p>}
              {banner.ctaText && <Link href={banner.ctaLink || "/products"} className={styles.shopButton}>{banner.ctaText} <ArrowRight size={14} aria-hidden /></Link>}
            </div>}
          </article>
        })}
      </div>}
    </section>
  )
}
