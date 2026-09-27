import type { Config } from "tailwindcss"
import tailwindcssAnimate from "tailwindcss-animate"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],  theme: {
    extend: {
      fontFamily: {
        heading: ['var(--font-heading)', 'Poppins', 'sans-serif'],
        body: ['var(--font-body)', 'Inter', 'sans-serif'],
        script: ['var(--font-script)', 'Segoe Script', 'cursive'],
      },
      colors: {
        // Resolved from CSS variables so a theme change repaints every
        // component that already uses these classes. The `-rgb` channel form
        // is what makes opacity modifiers (bg-brand-primary/10) work.
        brand: {
          primary: 'rgb(var(--brand-primary-rgb) / <alpha-value>)',
          'primary-hover': 'rgb(var(--brand-primary-hover-rgb) / <alpha-value>)',
          'primary-light': 'rgb(var(--brand-primary-light-rgb) / <alpha-value>)',
          'primary-subtle': 'rgb(var(--brand-primary-subtle-rgb) / <alpha-value>)',
          accent: 'rgb(var(--brand-accent-rgb) / <alpha-value>)',
          'accent-hover': 'rgb(var(--brand-accent-hover-rgb) / <alpha-value>)',
          surface: 'rgb(var(--brand-surface-rgb) / <alpha-value>)',
          'surface-raised': 'rgb(var(--brand-surface-raised-rgb) / <alpha-value>)',
          'text-primary': 'rgb(var(--brand-text-primary-rgb) / <alpha-value>)',
          'text-secondary': 'rgb(var(--brand-text-secondary-rgb) / <alpha-value>)',
          'text-tertiary': 'rgb(var(--brand-text-tertiary-rgb) / <alpha-value>)',
          border: 'rgb(var(--brand-border-rgb) / <alpha-value>)',
          'border-hover': 'rgb(var(--brand-border-hover-rgb) / <alpha-value>)',
          success: 'rgb(var(--brand-success-rgb) / <alpha-value>)',
          warning: 'rgb(var(--brand-warning-rgb) / <alpha-value>)',
          'hero-from': 'rgb(var(--brand-hero-from-rgb) / <alpha-value>)',
          'hero-via': 'rgb(var(--brand-hero-via-rgb) / <alpha-value>)',
          'hero-to': 'rgb(var(--brand-hero-to-rgb) / <alpha-value>)',
          glow: 'rgb(var(--brand-glow-rgb) / <alpha-value>)',
          ribbon: 'rgb(var(--brand-ribbon-rgb) / <alpha-value>)',
          'ribbon-text': 'rgb(var(--brand-ribbon-text-rgb) / <alpha-value>)',
        },
        // Legacy palette from the pre-SARA theme. ~130 `maroon-*` classes still
        // exist across admin/account pages; without this they compile to nothing
        // and `bg-maroon-800 text-white` renders as white-on-transparent.
        // Mapped onto the SARA blues so those screens stay legible.
        maroon: {
          50: "#F4F8FD",
          100: "#E8F1FC",
          200: "#CFE2F8",
          300: "#A9C9F0",
          400: "#5B93D6",
          500: "#1560BD",
          600: "#1560BD",
          700: "#12509E",
          800: "#0F2557",
          900: "#0A1B40",
        },
        blue: {
          DEFAULT: "#003087",
          50: "#e6f0ff",
          100: "#cce0ff",
          200: "#99c2ff",
          300: "#66a3ff",
          400: "#3385ff",
          500: "#0066ff",
          600: "#0052cc",
          700: "#003d99",
          800: "#003087",
          900: "#001a4d",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "float-medium": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-15px)" },
        },
        "float-fast": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float-slow": "float-slow 8s ease-in-out infinite",
        "float-medium": "float-medium 6s ease-in-out infinite",
        "float-fast": "float-fast 4s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
export default config
