'use client'

import { ReactNode } from 'react'

interface SmoothScrollProviderProps {
  children: ReactNode
}

/**
 * Scroll provider - native CSS smooth scrolling.
 * Lenis was removed because it interfered with the native scrollbar.
 */
export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  return <>{children}</>
}
