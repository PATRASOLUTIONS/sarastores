/**
 * Sara Mobiles and Electronics  – Brand Guidelines
 * 
 * This file contains all brand identity elements including colors, typography,
 * spacing, and component styles to maintain consistency across the platform.
 */

// ==================== BRAND IDENTITY ====================
export const BRAND = {
  name: "Sara Mobiles and Electronics ",
  tagline: "Smart, Secure, Seamless",
  essence: "Professional, innovative, reliable, tech-driven",
  tone: "Confident, clear, modern, approachable",
} as const

// ==================== COLOR PALETTE ====================
export const COLORS = {
  // Primary
  primary: {
    blue: "#2A7FFF",
    blueDark: "#1E5FCC",
    blueLight: "#5B9FFF",
  },

  // Accents
  accent: {
    yellow: "#FFC107",
    green: "#00C48C",
  },

  // Neutrals
  neutral: {
    dark: "#1F1F1F",
    mid: "#666666",
    light: "#F5F5F5",
    white: "#FFFFFF",
  },

  // Semantic Colors
  semantic: {
    success: "#00C48C",
    warning: "#FFC107",
    error: "#EF4444",
    info: "#2A7FFF",
  },
} as const

// ==================== TYPOGRAPHY ====================
export const TYPOGRAPHY = {
  fonts: {
    heading: "'Poppins', sans-serif",
    body: "'Roboto', sans-serif",
  },

  sizes: {
    h1: "48px",      // Hero
    h2: "32px",      // Section
    h3: "24px",      // Subsection
    h4: "20px",      // Card titles
    body: "16px",    // Body text
    small: "14px",   // Small text
    tiny: "12px",    // Labels
  },

  weights: {
    bold: 700,
    semibold: 600,
    medium: 500,
    regular: 400,
  },

  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.8,
  },
} as const

// ==================== SPACING SYSTEM ====================
// Base unit: 8px scale
export const SPACING = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  "2xl": "48px",
  "3xl": "64px",
  "4xl": "96px",
} as const

export const SECTION_PADDING = {
  desktop: "48px",
  mobile: "24px",
} as const

// ==================== UI ELEMENTS ====================
export const UI = {
  // Border Radius
  radius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    full: "9999px",
  },

  // Shadows
  shadows: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
  },

  // Transitions
  transitions: {
    fast: "150ms ease-in-out",
    normal: "300ms ease-in-out",
    slow: "500ms ease-in-out",
  },
} as const

// ==================== BUTTON STYLES ====================
export const BUTTON_STYLES = {
  primary: {
    backgroundColor: COLORS.primary.blue,
    color: COLORS.neutral.white,
    border: "none",
    hover: {
      backgroundColor: COLORS.primary.blueDark,
    },
  },

  secondary: {
    backgroundColor: COLORS.neutral.white,
    color: COLORS.primary.blue,
    border: `2px solid ${COLORS.primary.blue}`,
    hover: {
      backgroundColor: COLORS.primary.blue,
      color: COLORS.neutral.white,
    },
  },

  success: {
    backgroundColor: COLORS.accent.green,
    color: COLORS.neutral.white,
    border: "none",
  },

  warning: {
    backgroundColor: COLORS.accent.yellow,
    color: COLORS.neutral.dark,
    border: "none",
  },

  danger: {
    backgroundColor: COLORS.semantic.error,
    color: COLORS.neutral.white,
    border: "none",
  },
} as const

// ==================== CARD STYLES ====================
export const CARD_STYLES = {
  backgroundColor: COLORS.neutral.white,
  borderRadius: UI.radius.md,
  boxShadow: UI.shadows.md,
  padding: SPACING.lg,
  border: `1px solid ${COLORS.neutral.light}`,
} as const

// ==================== INPUT STYLES ====================
export const INPUT_STYLES = {
  default: {
    border: `1px solid ${COLORS.neutral.mid}`,
    borderRadius: UI.radius.md,
    padding: `${SPACING.sm} ${SPACING.md}`,
    fontSize: TYPOGRAPHY.sizes.body,
  },

  focus: {
    borderColor: COLORS.primary.blue,
    outline: `2px solid ${COLORS.primary.blueLight}`,
    outlineOffset: "2px",
  },

  error: {
    borderColor: COLORS.semantic.error,
    outline: `2px solid ${COLORS.semantic.error}`,
  },
} as const

// ==================== BADGE STYLES ====================
export const BADGE_STYLES = {
  sale: {
    backgroundColor: COLORS.accent.yellow,
    color: COLORS.neutral.dark,
  },

  success: {
    backgroundColor: COLORS.accent.green,
    color: COLORS.neutral.white,
  },

  info: {
    backgroundColor: COLORS.primary.blue,
    color: COLORS.neutral.white,
  },

  warning: {
    backgroundColor: COLORS.accent.yellow,
    color: COLORS.neutral.dark,
  },
} as const

// ==================== GRADIENT STYLES ====================
export const GRADIENTS = {
  primary: `linear-gradient(135deg, ${COLORS.primary.blue} 0%, ${COLORS.primary.blueDark} 100%)`,
  hero: `linear-gradient(135deg, ${COLORS.primary.blue} 0%, #1E40AF 100%)`,
  overlay: `linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)`,
  blueOverlay: `linear-gradient(to top, ${COLORS.primary.blue}CC 0%, ${COLORS.primary.blue}66 100%)`,
} as const

// ==================== LAYOUT GRID ====================
export const GRID = {
  columns: 12,
  gutter: SPACING.lg,
  maxWidth: "1280px",
  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },
} as const

// ==================== MESSAGING & VOICE ====================
export const MESSAGING = {
  ctas: [
    "Discover",
    "Transform",
    "Get Started",
    "Secure Your Business",
    "Shop Now",
    "Learn More",
    "Explore Solutions",
  ],

  titleCase: true, // Use Title Case for headers
  sentenceCase: true, // Use Sentence case for body text
} as const

// ==================== IMAGERY GUIDELINES ====================
export const IMAGERY = {
  style: "Tech-focused, modern, futuristic",
  overlayColor: `${COLORS.primary.blue}99`, // Semi-transparent blue
  aspectRatios: {
    hero: "16:9",
    product: "1:1",
    card: "4:3",
    banner: "21:9",
  },
} as const

// ==================== ACCESSIBILITY ====================
export const ACCESSIBILITY = {
  minContrastRatio: 4.5, // WCAG AA standard
  focusVisible: true,
  keyboardNavigation: true,
} as const

// ==================== LOGO GUIDELINES ====================
export const LOGO = {
  clearSpace: "height of S", // Minimum clear space around logo
  variations: ["full-color", "monochrome", "stacked", "horizontal"],
  donts: [
    "Never distort the logo",
    "Never recolor outside approved palette",
    "Never crowd the logo with other elements",
    "Never rotate or skew the logo",
  ],
} as const

// ==================== HELPER FUNCTIONS ====================

/**
 * Get Tailwind CSS classes for primary button
 */
export const getPrimaryButtonClasses = () => {
  return "bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-all duration-300 shadow-md hover:shadow-lg"
}

/**
 * Get Tailwind CSS classes for secondary button
 */
export const getSecondaryButtonClasses = () => {
  return "bg-white hover:bg-blue-600 text-blue-600 hover:text-white border-2 border-blue-600 font-medium py-2 px-6 rounded-lg transition-all duration-300"
}

/**
 * Get Tailwind CSS classes for card
 */
export const getCardClasses = () => {
  return "bg-white rounded-lg shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow duration-300"
}

/**
 * Get Tailwind CSS classes for input
 */
export const getInputClasses = () => {
  return "w-full px-4 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
}

/**
 * Get Tailwind CSS classes for section padding
 */
export const getSectionPaddingClasses = () => {
  return "py-12 md:py-16 lg:py-20"
}

/**
 * Get Tailwind CSS classes for container
 */
export const getContainerClasses = () => {
  return "container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl"
}

/**
 * Get gradient background style
 */
export const getGradientStyle = (type: keyof typeof GRADIENTS = "primary") => {
  return { background: GRADIENTS[type] }
}

/**
 * Get heading classes based on level
 */
export const getHeadingClasses = (level: 1 | 2 | 3 | 4) => {
  const classes = {
    1: "text-4xl md:text-5xl font-bold text-gray-900",
    2: "text-3xl md:text-4xl font-semibold text-gray-900",
    3: "text-2xl md:text-3xl font-semibold text-gray-900",
    4: "text-xl md:text-2xl font-medium text-gray-900",
  }
  return classes[level]
}

/**
 * Get badge classes based on type
 */
export const getBadgeClasses = (type: "sale" | "success" | "info" | "warning") => {
  const classes = {
    sale: "bg-yellow-400 text-gray-900 px-3 py-1 rounded-full text-sm font-medium",
    success: "bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium",
    info: "bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium",
    warning: "bg-yellow-400 text-gray-900 px-3 py-1 rounded-full text-sm font-medium",
  }
  return classes[type]
}

// ==================== EXPORT ALL ====================
export default {
  BRAND,
  COLORS,
  TYPOGRAPHY,
  SPACING,
  SECTION_PADDING,
  UI,
  BUTTON_STYLES,
  CARD_STYLES,
  INPUT_STYLES,
  BADGE_STYLES,
  GRADIENTS,
  GRID,
  MESSAGING,
  IMAGERY,
  ACCESSIBILITY,
  LOGO,
  // Helper functions
  getPrimaryButtonClasses,
  getSecondaryButtonClasses,
  getCardClasses,
  getInputClasses,
  getSectionPaddingClasses,
  getContainerClasses,
  getGradientStyle,
  getHeadingClasses,
  getBadgeClasses,
}
