"use client"

import { useCartContext } from "@/contexts/CartContext"

import type { CartItem, Order, Address } from "@/contexts/CartContext"

export type { CartItem, Order, Address }

/**
 * Backwards-compatible facade over `useCartContext`.
 *
 * Every consumer in the codebase (Header, CartSidebar, CartQuickAccess,
 * AddToCartButton, product page, cart page, dashboard, checkout, etc.)
 * already calls `useCart()`. They all now read from the same singleton
 * `CartProvider`, so mounting any page issues exactly one `GET /api/cart`
 * (and only on actual userId change — not on every AuthContext re-render).
 */
export function useCart() {
  return useCartContext()
}
