"use client"

import type { ReactNode } from "react"
import { Suspense } from "react"
import LoginReturnTracker from "@/components/LoginReturnTracker"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/AuthContext"
import { CartUIProvider } from "@/contexts/CartUIContext"
import { CartProvider } from "@/contexts/CartContext"
import { Toaster } from "react-hot-toast"
import CompareFloating from "@/components/CompareFloating"
import CartSidebar from "@/components/CartSidebar"
import CartQuickAccess from "@/components/CartQuickAccess"
import AntiInspect from "@/components/AntiInspect"
import { MotionConfig } from "framer-motion"

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange forcedTheme="light">
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <Suspense fallback={null}>
            <LoginReturnTracker />
          </Suspense>
          <AntiInspect />
          <CartProvider>
            <CartUIProvider>
              {children}
              <CompareFloating />
              <CartQuickAccess />
              <CartSidebar />
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
      </MotionConfig>
    </ThemeProvider>
  )
}
