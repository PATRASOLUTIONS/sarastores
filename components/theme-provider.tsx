'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <>{children}</>
  }

  // Filter out any undefined or invalid props
  const safeProps = Object.fromEntries(
    Object.entries(props).filter(([_, value]) => value !== undefined && value !== null)
  )

  return (
    <NextThemesProvider 
      attribute="class" 
      defaultTheme="light" 
      enableSystem={false} 
      disableTransitionOnChange 
      forcedTheme="light"
      {...safeProps}
    >
      {children}
    </NextThemesProvider>
  )
}
