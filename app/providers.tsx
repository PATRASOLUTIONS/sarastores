"use client"

import type { ReactNode } from "react"
import { Suspense } from "react"
import dynamic from "next/dynamic"
import LoginReturnTracker from "@/components/LoginReturnTracker"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/AuthContext"
import { CartUIProvider } from "@/contexts/CartUIContext"
import { CartProvider } from "@/contexts/CartContext"
import { Toaster } from "react-hot-toast"
import CompareFloating from "@/components/CompareFloating"
import LazyCartChrome from "@/components/LazyCartChrome"
import AntiInspect from "@/components/AntiInspect"
import { LazyMotion, MotionConfig } from "framer-motion"

const loadMotionFeatures = () => import("@/components/animation-features").then(module => module.default)
const StorefrontPromotionEntry = dynamic(() => import("@/components/promotions/StorefrontPromotionEntry"), { ssr: false })

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange forcedTheme="light">
      <LazyMotion features={loadMotionFeatures}><MotionConfig reducedMotion="user">
        <AuthProvider>
          <Suspense fallback={null}>
            <LoginReturnTracker />
          </Suspense>
          <AntiInspect />
          <CartProvider>
            <CartUIProvider>
              {children}
              <CompareFloating />
              <LazyCartChrome />
              <Suspense fallback={null}><StorefrontPromotionEntry /></Suspense>
              {/*
                A toast grows to fit its message, and dismissal pauses while
                one is hovered. An over-long message therefore covers the
                viewport, parks itself under the pointer and never expires.
                Callers trim product names (see `toastProductName`); this caps
                whatever still gets through.
              */}
              <Toaster
                position="top-right"
                toastOptions={{ style: { maxHeight: "30vh", overflow: "hidden" } }}
              />
            </CartUIProvider>
          </CartProvider>
        </AuthProvider>
      </MotionConfig></LazyMotion>
    </ThemeProvider>
  )
}
