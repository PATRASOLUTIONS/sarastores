/**
 * Animation Utilities & Constants
 * 
 * Centralized animation configuration for consistent, performant motion.
 * Inspired by Stripe, Apple, Linear — subtle, physics-based, premium.
 * 
 * Rules:
 * - Only animate transform & opacity (GPU-accelerated)
 * - Durations: 200–600ms
 * - Respect prefers-reduced-motion
 * - Use will-change sparingly (only during animation)
 */

// ─── Easing Curves ───────────────────────────────────────────────────────
export const easings = {
  // Apple-like smooth deceleration
  out: [0.16, 1, 0.3, 1] as const,
  // Smooth entry
  in: [0.4, 0, 1, 1] as const,
  // Balanced in-out
  inOut: [0.65, 0, 0.35, 1] as const,
  // Gentle spring-like feel without actual spring
  smooth: [0.25, 0.46, 0.45, 0.94] as const,
  // GSAP power2.out equivalent
  power2Out: [0.22, 1, 0.36, 1] as const,
  // GSAP power3.out equivalent
  power3Out: [0.16, 1, 0.3, 1] as const,
} as const

// CSS versions of the easings
export const cssEasings = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  power2Out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  power3Out: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const

// ─── Duration Constants ──────────────────────────────────────────────────
export const durations = {
  fast: 0.2,      // 200ms - micro-interactions (button press)
  normal: 0.35,   // 350ms - standard transitions
  medium: 0.5,    // 500ms - entrance animations
  slow: 0.6,      // 600ms - hero/dramatic reveals
  stagger: 0.08,  // 80ms - stagger delay between items
} as const

// ─── Framer Motion Variants ─────────────────────────────────────────────

/** Fade up entrance — for sections, cards, content blocks */
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durations.medium,
      ease: easings.power3Out,
    },
  },
}

/** Fade in — simple opacity transition */
export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: durations.normal,
      ease: easings.out,
    },
  },
}

/** Staggered container — wrap children that use fadeUp/fadeIn */
export const staggerContainer = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: durations.stagger,
      delayChildren: 0.1,
    },
  },
}

/** Scale fade — for modals, dropdowns, overlays */
export const scaleFade = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: durations.normal,
      ease: easings.power2Out,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: durations.fast,
      ease: easings.in,
    },
  },
}

/** Slide down — for dropdowns, menus */
export const slideDown = {
  hidden: { opacity: 0, y: -8, scaleY: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scaleY: 1,
    transition: {
      duration: durations.normal,
      ease: easings.power2Out,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scaleY: 0.96,
    transition: {
      duration: durations.fast,
      ease: easings.in,
    },
  },
}

/** Collapse animation — for removing items */
export const collapseItem = {
  initial: { opacity: 1, height: 'auto', scale: 1 },
  exit: {
    opacity: 0,
    height: 0,
    scale: 0.95,
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    transition: {
      opacity: { duration: durations.fast, ease: easings.in },
      height: { duration: durations.normal, ease: easings.inOut },
      scale: { duration: durations.fast, ease: easings.in },
    },
  },
}

/** Number tick animation — for price, quantity changes */
export const numberTick = {
  initial: { opacity: 0, y: -10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durations.normal,
      ease: easings.power2Out,
    },
  },
  exit: {
    opacity: 0,
    y: 10,
    transition: {
      duration: durations.fast,
      ease: easings.in,
    },
  },
}

// ─── Button Interaction Props ────────────────────────────────────────────
export const buttonPress = {
  whileTap: { scale: 0.97 },
  transition: { duration: durations.fast, ease: easings.out },
}

export const buttonHover = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: { type: 'spring', stiffness: 400, damping: 17 },
}

// ─── Card Interaction Props ──────────────────────────────────────────────
export const cardHover = {
  whileHover: { y: -4, scale: 1.01 },
  transition: { type: 'spring', stiffness: 300, damping: 20 },
}

export const imageHover = {
  whileHover: { scale: 1.03 },
  transition: { duration: durations.medium, ease: easings.out },
}

// ─── Utility: Reduced Motion Check ──────────────────────────────────────
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}


