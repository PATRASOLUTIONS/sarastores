'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Hook to detect if user prefers reduced motion.
 * Respects OS-level accessibility settings.
 */
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReduced(mq.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return prefersReduced
}

/**
 * Hook for scroll-based header shrink with debounced scroll listener.
 * Returns scroll state for use in navbar animations.
 */
export function useScrollState(threshold = 10) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const ticking = useRef(false)

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(() => {
          const y = window.scrollY
          setScrollY(y)
          setIsScrolled(y > threshold)
          ticking.current = false
        })
        ticking.current = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [threshold])

  return { isScrolled, scrollY }
}

/**
 * Hook for staggered entrance animations using IntersectionObserver.
 * Each child element gets a delayed entrance for a cascading reveal effect.
 */
export function useStaggerReveal(staggerDelay = 80) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Check prefers-reduced-motion
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { containerRef, isVisible, staggerDelay }
}

/**
 * Hook for animated number transitions (price, quantity).
 * Smoothly transitions between old and new values.
 */
export function useAnimatedNumber(value: number, duration = 300) {
  const [displayValue, setDisplayValue] = useState(value)
  const previousValue = useRef(value)
  const animationRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const start = previousValue.current
    const end = value
    previousValue.current = value

    if (start === end) return

    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = start + (end - start) * eased

      setDisplayValue(current)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [value, duration])

  return displayValue
}

/**
 * Hook for element entrance animation using IntersectionObserver.
 * Returns a ref and visibility state for use with CSS or Framer Motion.
 */
export function useInViewAnimation(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      setIsInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -60px 0px',
        ...options,
      }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, isInView }
}
