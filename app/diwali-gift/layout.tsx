'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export default function DiwaliGiftLayout({ children }: { children: ReactNode }) {
  const registrationPage = usePathname().replace(/\/$/, '') === '/diwali-gift'
  return (
    <div className="flex min-h-screen flex-col">
      {!registrationPage && <Header />}
      <main id="main-content" className="flex-1">
        {children}
      </main>
      {!registrationPage && <Footer />}
    </div>
  )
}
