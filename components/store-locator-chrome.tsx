"use client"

import { BadgeCheck, Headphones, MapPin, ShoppingBag, Store, Tag, Users } from "lucide-react"
import { useSettingsData } from "@/hooks/useSettingsData"
import styles from "./store-locator.module.css"

const HERO_POINTS = [
  { icon: MapPin, title: "Wide Network", detail: "Across Karnataka" },
  { icon: BadgeCheck, title: "Genuine", detail: "Products" },
  { icon: Users, title: "Expert Guidance", detail: "In-Store" },
  { icon: ShoppingBag, title: "Best Offers", detail: "Near You" },
]

export function StoreLocatorHero() {
  const { data } = useSettingsData()
  return (
    <section className={styles.hero} aria-labelledby="locator-hero">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data?.storefrontImage || "/store-locator/hero-store.webp"} alt="SARA electronics storefront" className={styles.heroPhoto} />
      <div className={styles.heroContent}>
        <h1 id="locator-hero" className="font-heading">Find a SARA Store<br />Near You</h1>
        <p className={styles.heroSubtitle}>{data?.statStores || "85+"} Stores Across Karnataka | Always Close to You</p>
        <ul className={styles.heroPoints}>
          {HERO_POINTS.map(({ icon: Icon, title, detail }) => <li key={title}><Icon strokeWidth={1.7} /><div><p>{title}</p><p>{detail}</p></div></li>)}
        </ul>
      </div>
    </section>
  )
}

export function StoreLocatorTrust() {
  const { data } = useSettingsData()
  const items = [
    { icon: Store, title: `${data?.statStores || "85+"} Stores`, detail: "Across Karnataka" },
    { icon: BadgeCheck, title: "100% Genuine Products", detail: "From Top Brands" },
    { icon: Tag, title: "Exclusive In-Store Offers", detail: "& Store Pickup" },
    { icon: Headphones, title: "Expert Assistance", detail: "From Our Team" },
  ]
  return <section aria-label="Why visit a SARA store"><ul className={styles.trust}>{items.map(({ icon: Icon, title, detail }) =>
    <li key={title}><Icon /><div><p>{title}</p><span>{detail}</span></div></li>)}</ul></section>
}
