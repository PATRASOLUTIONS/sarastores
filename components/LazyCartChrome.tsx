"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { useCartUI } from "@/contexts/CartUIContext"
import { useCart } from "@/hooks/useCart"
import { useAuth } from "@/contexts/AuthContext"

function CartLoading() {
  const { isOpen, closeCart } = useCartUI()
  if (!isOpen) return null
  return <div className="fixed inset-0 z-[100] bg-black/30" role="dialog" aria-modal="true" aria-label="Shopping cart">
    <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white p-6">
      <button type="button" onClick={closeCart} className="float-right min-h-11 px-3">Close cart</button>
      <p role="status">Loading your cart…</p>
    </div>
  </div>
}

const CartSidebar = dynamic(() => import("@/components/CartSidebar"), { ssr: false, loading: CartLoading })
const CartQuickAccess = dynamic(() => import("@/components/CartQuickAccess"), { ssr: false })

/** Preserve exit animations after first opening; skip drawer code/settings before then. */
export default function LazyCartChrome() {
  const { isOpen } = useCartUI()
  const { cart } = useCart()
  const { user } = useAuth()
  const [opened, setOpened] = useState(false)
  const [desktop, setDesktop] = useState(false)
  useEffect(() => { if (isOpen) setOpened(true) }, [isOpen])
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)")
    const update = () => setDesktop(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  return <>
    {(isOpen || opened) && <CartSidebar />}
    {desktop && user && cart.length > 0 && <CartQuickAccess />}
  </>
}
