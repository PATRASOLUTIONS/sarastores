"use client"

import { useEffect, useRef, useState } from "react"
import { getStoreBusiness } from "@/lib/store-business-client"
import type { Store } from "@/lib/store-data"
import type { StoreBusiness } from "@/lib/store-business-types"
import styles from "@/components/store-locator.module.css"

export function StoreGooglePhoto({ store, fallback }: { store: Store; fallback: string }) {
  const target = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [business, setBusiness] = useState<StoreBusiness | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!target.current || typeof IntersectionObserver === "undefined") { setVisible(true); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() }
    }, { rootMargin: "150px" })
    observer.observe(target.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    void getStoreBusiness(store.id).then(data => { if (!cancelled) setBusiness(data) }).catch(() => {})
    return () => { cancelled = true }
  }, [store.id, visible])
  const googlePhoto = !failed && business?.photoUrl
  return <figure ref={target} className={styles.storePhotoWrap}>
    <img src={googlePhoto || store.image || fallback} alt={googlePhoto || store.image ? store.name : "SARA storefront illustration"}
      className={styles.storePhoto} loading="lazy" onError={event => {
        if (googlePhoto) { setFailed(true); return }
        if (!event.currentTarget.dataset.fallback) { event.currentTarget.dataset.fallback = "true"; event.currentTarget.src = "/store-locator/storefront.webp" }
      }} />
    {googlePhoto && <figcaption className={styles.photoCredit}>Google{business?.photoCredits?.map((credit, index) =>
      credit.url ? <a key={index} href={credit.url} target="_blank" rel="noopener noreferrer"> / {credit.name}</a> : <span key={index}> / {credit.name}</span>)}</figcaption>}
  </figure>
}
