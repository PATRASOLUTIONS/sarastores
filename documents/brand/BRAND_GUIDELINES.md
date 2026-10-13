# Sara Mobiles and Electronics  – Brand Guidelines

## 📘 Overview

This document outlines the complete brand identity system for **Sara Mobiles and Electronics **. All team members, designers, and developers must follow these guidelines to maintain brand consistency across all touchpoints.

---

## 1. Brand Identity

- **Name:** Sara Mobiles and Electronics 
- **Tagline:** Smart, Secure, Seamless
- **Essence:** Professional, innovative, reliable, tech-driven
- **Tone & Voice:** Confident, clear, modern, approachable

---

## 2. Logo Guidelines

### Primary Logo
- Wordmark "Sara Mobiles and Electronics " in **Poppins Bold**
- Stylized tech-inspired "S" in blue (#2A7FFF)

### Logo Variations
- ✅ Full-color
- ✅ Monochrome
- ✅ Stacked
- ✅ Horizontal

### Clear Space
- Maintain at least the height of "S" around the logo on all sides
- Never crowd the logo with other elements

### Logo Don'ts
- ❌ Never distort or stretch the logo
- ❌ Never recolor outside the approved palette
- ❌ Never rotate or skew the logo
- ❌ Never add effects (shadows, gradients) to the logo
- ❌ Never place on busy backgrounds without proper contrast

---

## 3. Color Palette

### Primary Colors
```
Primary Blue:     #2A7FFF
Blue Dark:        #1E5FCC (hover states)
Blue Light:       #5B9FFF (accents)
```

### Accent Colors
```
Accent Yellow:    #FFC107 (sale badges, warnings)
Accent Green:     #00C48C (success states)
```

### Neutral Colors
```
Neutral Dark:     #1F1F1F (primary text)
Neutral Mid:      #666666 (secondary text)
Neutral Light:    #F5F5F5 (backgrounds)
White:            #FFFFFF
```

### Semantic Colors
```
Success:          #00C48C
Warning:          #FFC107
Error:            #EF4444
Info:             #2A7FFF
```

### Usage Guidelines
- Use **Primary Blue** for CTAs, links, and primary actions
- Use **Accent Yellow** for sale badges and promotional elements
- Use **Accent Green** for success messages and confirmations
- Maintain WCAG AA contrast ratio (4.5:1 minimum)

---

## 4. Typography

### Font Families
- **Headings:** Poppins (Bold, SemiBold, Medium)
- **Body Text:** Roboto (Regular, Medium)

### Type Scale
```
H1 Hero:          48px, Poppins Bold
H2 Section:       32px, Poppins SemiBold
H3 Subsection:    24px, Poppins SemiBold
H4 Card Title:    20px, Poppins Medium
Body Text:        16px, Roboto Regular
Small Text:       14px, Roboto Regular
Tiny/Labels:      12px, Roboto Regular
```

### Line Heights
- **Tight (1.2):** Headlines and hero text
- **Normal (1.5):** Body text
- **Relaxed (1.8):** Long-form content

### Text Case
- **Title Case:** Headers and navigation
- **Sentence case:** Body text and descriptions

---

## 5. UI Elements

### Buttons

#### Primary Button
- Background: Primary Blue (#2A7FFF)
- Text: White (#FFFFFF)
- Border: None
- Hover: Blue Dark (#1E5FCC)
- Border Radius: 8px
- Padding: 12px 24px

#### Secondary Button
- Background: White (#FFFFFF)
- Text: Primary Blue (#2A7FFF)
- Border: 2px solid Primary Blue
- Hover: Background becomes Primary Blue, text becomes White
- Border Radius: 8px
- Padding: 12px 24px

### Cards
- Background: White (#FFFFFF)
- Border Radius: 8px
- Shadow: 0 4px 6px rgba(0,0,0,0.1)
- Border: 1px solid Neutral Light (#F5F5F5)
- Padding: 24px

### Input Fields
- Border: 1px solid Neutral Mid (#666666)
- Border Radius: 8px
- Padding: 8px 16px
- Focus: Border becomes Primary Blue with 2px outline
- Error: Border becomes Error Red (#EF4444)

### Badges
- **Sale:** Yellow background (#FFC107), Dark text
- **Success:** Green background (#00C48C), White text
- **Info:** Blue background (#2A7FFF), White text
- Border Radius: Full (pill shape)
- Padding: 4px 12px

---

## 6. Imagery Style

### Photo Guidelines
- **Style:** Tech-focused, modern, futuristic
- **Subject:** Clean product shots and lifestyle photography
- **Lighting:** Bright, natural, high-contrast
- **Composition:** Minimal, uncluttered

### Image Overlays
- Use semi-transparent Primary Blue (#2A7FFF99) for text overlays
- Gradient from dark to transparent for readability

### Aspect Ratios
- Hero Images: 16:9
- Product Images: 1:1
- Card Images: 4:3
- Banners: 21:9

---

## 7. Layout & Spacing

### Grid System
- **Columns:** 12-column responsive grid
- **Gutter:** 24px
- **Max Width:** 1280px

### Spacing Scale (8px base)
```
XS:  4px
SM:  8px
MD:  16px
LG:  24px
XL:  32px
2XL: 48px
3XL: 64px
4XL: 96px
```

### Section Padding
- **Desktop:** 48px top/bottom
- **Mobile:** 24px top/bottom

### Breakpoints
```
SM:  640px
MD:  768px
LG:  1024px
XL:  1280px
2XL: 1536px
```

---

## 8. Voice & Messaging

### Brand Voice
- **Confident:** We know our technology
- **Clear:** No jargon, straightforward communication
- **Modern:** Forward-thinking and innovative
- **Approachable:** Friendly and helpful

### Call-to-Actions (CTAs)
✅ Recommended CTAs:
- "Discover"
- "Transform"
- "Get Started"
- "Secure Your Business"
- "Shop Now"
- "Learn More"
- "Explore Solutions"

❌ Avoid:
- "Click Here"
- "Submit"
- Generic phrases

### Writing Style
- Use active voice
- Keep sentences concise
- Focus on benefits, not just features
- Address the user directly ("you", "your")

---

## 9. Accessibility Standards

### Color Contrast
- Maintain WCAG AA standard (4.5:1 contrast ratio)
- Test all text/background combinations

### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Visible focus states required

### Alt Text
- Provide descriptive alt text for all images
- Don't start with "Image of..." or "Picture of..."

### Screen Readers
- Use semantic HTML
- Provide ARIA labels where needed

---

## 10. Do's & Don'ts

### ✅ Do's
- Use approved fonts and colors consistently
- Keep the logo consistent across all platforms
- Ensure all designs meet accessibility standards
- Use the 8px spacing scale
- Test designs on multiple devices
- Maintain proper hierarchy
- Use high-quality images

### ❌ Don'ts
- Don't distort or recolor the logo
- Don't use mismatched fonts
- Don't create cluttered, low-contrast designs
- Don't use colors outside the approved palette
- Don't ignore mobile responsiveness
- Don't overcomplicate layouts
- Don't use poor quality or pixelated images

---

## 11. Implementation

### Using Brand Guidelines in Code

Import the brand guidelines in your components:

```typescript
import BrandGuidelines, {
  COLORS,
  TYPOGRAPHY,
  getPrimaryButtonClasses,
  getCardClasses,
} from '@/lib/brandGuidelines'

// Use helper functions
<button className={getPrimaryButtonClasses()}>
  Get Started
</button>

// Or use the constants directly
<div style={{ color: COLORS.primary.blue }}>
  Sara Mobiles and Electronics 
</div>
```

### Tailwind Configuration

The brand colors are already integrated into your Tailwind config. Use them like:

```jsx
<button className="bg-blue-600 hover:bg-blue-700 text-white">
  Primary Button
</button>
```

---

## 12. Brand Assets Location

All brand assets should be stored in:
```
/public/brand/
  ├── logo-full-color.svg
  ├── logo-monochrome.svg
  ├── logo-stacked.svg
  └── logo-horizontal.svg
```

---

## 13. Questions & Support

For questions about brand guidelines or design approvals, contact:
- **Design Team:** design@systechdigital.com
- **Brand Manager:** brand@systechdigital.com

---

**Last Updated:** October 2025  
**Version:** 1.0
