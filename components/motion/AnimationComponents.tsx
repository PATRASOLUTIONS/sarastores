'use client'

import React, { useRef, useEffect, useState, ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  fadeUp,
  fadeIn,
  staggerContainer,
  scaleFade,
  slideDown,
  collapseItem,
  numberTick,
  buttonPress,
  durations,
  easings,
} from '@/lib/animations'

// ─── Reveal on Scroll ────────────────────────────────────────────────────

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  duration?: number
  once?: boolean
}

/** Reveals content when it enters the viewport. GPU-accelerated, 60fps. */
export function Reveal({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  duration = durations.medium,
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (prefersReduced) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [once, prefersReduced])

  const directionOffset = {
    up: { y: 24, x: 0 },
    down: { y: -24, x: 0 },
    left: { x: 24, y: 0 },
    right: { x: -24, y: 0 },
    none: { x: 0, y: 0 },
  }

  const offset = directionOffset[direction]

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={prefersReduced ? {} : { opacity: 0, ...offset }}
      animate={
        isVisible
          ? { opacity: 1, x: 0, y: 0 }
          : prefersReduced
          ? {}
          : { opacity: 0, ...offset }
      }
      transition={{
        duration: prefersReduced ? 0 : duration,
        delay: prefersReduced ? 0 : delay,
        ease: easings.power3Out,
      }}
    >
      {children}
    </motion.div>
  )
}

// ─── Stagger Children ───────────────────────────────────────────────────

interface StaggerChildrenProps {
  children: ReactNode
  className?: string
  staggerDelay?: number
  once?: boolean
}

/** Staggers child elements with cascading entrance animation. */
export function StaggerChildren({
  children,
  className = '',
  staggerDelay = durations.stagger,
  once = true,
}: StaggerChildrenProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (prefersReduced) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) observer.disconnect()
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -40px 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [once, prefersReduced])

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isVisible ? 'visible' : 'hidden'}
      variants={{
        hidden: { opacity: 1 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: prefersReduced ? 0 : staggerDelay,
            delayChildren: prefersReduced ? 0 : 0.1,
          },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

// ─── Stagger Item ────────────────────────────────────────────────────────

interface StaggerItemProps {
  children: ReactNode
  className?: string
}

/** Individual stagger item — use inside <StaggerChildren>. */
export function StaggerItem({ children, className = '' }: StaggerItemProps) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  )
}

// ─── Animated Counter ────────────────────────────────────────────────────

interface AnimatedCounterProps {
  value: number
  prefix?: string
  suffix?: string
  className?: string
  formatFn?: (value: number) => string
}

/** Smoothly animate between number values — for prices, quantities, totals. */
export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  className = '',
  formatFn,
}: AnimatedCounterProps) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={value}
        className={className}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: durations.fast, ease: easings.power2Out }}
      >
        {prefix}
        {formatFn ? formatFn(value) : value}
        {suffix}
      </motion.span>
    </AnimatePresence>
  )
}

// ─── Collapsible Item ────────────────────────────────────────────────────

interface CollapsibleItemProps {
  children: ReactNode
  className?: string
  isVisible: boolean
  itemKey: string | number
}

/** Animated collapse/expand for list items (cart removal, etc.) */
export function CollapsibleItem({
  children,
  className = '',
  isVisible,
  itemKey,
}: CollapsibleItemProps) {
  return (
    <AnimatePresence mode="popLayout">
      {isVisible && (
        <motion.div
          key={itemKey}
          className={className}
          initial={{ opacity: 0, height: 0, scale: 0.96 }}
          animate={{
            opacity: 1,
            height: 'auto',
            scale: 1,
            transition: {
              opacity: { duration: durations.normal, ease: easings.out },
              height: { duration: durations.normal, ease: easings.inOut },
              scale: { duration: durations.normal, ease: easings.out },
            },
          }}
          exit={{
            opacity: 0,
            height: 0,
            scale: 0.96,
            transition: {
              opacity: { duration: durations.fast, ease: easings.in },
              height: { duration: durations.normal, ease: easings.inOut, delay: 0.05 },
              scale: { duration: durations.fast, ease: easings.in },
            },
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Skeleton Fade ───────────────────────────────────────────────────────

interface SkeletonFadeProps {
  isLoading: boolean
  skeleton: ReactNode
  children: ReactNode
  className?: string
}

/** Crossfade from skeleton loader to real content. */
export function SkeletonFade({
  isLoading,
  skeleton,
  children,
  className = '',
}: SkeletonFadeProps) {
  return (
    <div className={`relative ${className}`}>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: durations.normal, ease: easings.out }}
          >
            {skeleton}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: durations.normal, ease: easings.out }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Page Transition Wrapper ─────────────────────────────────────────────

interface PageTransitionProps {
  children: ReactNode
  className?: string
}

/** Wraps page content with a smooth fade-up entrance animation. */
export function PageTransition({ children, className = '' }: PageTransitionProps) {
  const prefersReduced = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={prefersReduced ? {} : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: prefersReduced ? 0 : durations.medium,
        ease: easings.power3Out,
      }}
    >
      {children}
    </motion.div>
  )
}

// ─── Dropdown Animation Wrapper ──────────────────────────────────────────

interface AnimatedDropdownProps {
  children: ReactNode
  isOpen: boolean
  className?: string
}

/** Dropdown with scale + fade animation. */
export function AnimatedDropdown({
  children,
  isOpen,
  className = '',
}: AnimatedDropdownProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={className}
          variants={scaleFade}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ originY: 0 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
