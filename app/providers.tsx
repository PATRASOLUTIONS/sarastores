"use client"

import type { ReactNode } from "react"
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
          <AntiInspect />
          <CartProvider>
            <CartUIProvider>
              {children}
              <CompareFloating />
              <CartQuickAccess />
              <CartSidebar />
              <Toaster position="top-right" />
            </CartUIProvider>
          </CartProvider>
        </AuthProvider>
      </MotionConfig>
    </ThemeProvider>
  )
}
