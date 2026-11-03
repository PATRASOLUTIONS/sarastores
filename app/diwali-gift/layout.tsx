import type { ReactNode } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export default function DiwaliGiftLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}
