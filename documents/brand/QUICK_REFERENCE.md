# Brand Guidelines - Quick Reference

## 🎨 Colors

```typescript
// Primary
#2A7FFF - Primary Blue (CTAs, links)
#1E5FCC - Blue Dark (hover states)
#5B9FFF - Blue Light (accents)

// Accents
#FFC107 - Yellow (sale badges)
#00C48C - Green (success)

// Neutrals
#1F1F1F - Dark (primary text)
#666666 - Mid (secondary text)
#F5F5F5 - Light (backgrounds)
#FFFFFF - White
```

## 📝 Typography

```typescript
// Fonts
Headings: 'Poppins', sans-serif
Body: 'Roboto', sans-serif

// Sizes
H1: 48px Bold
H2: 32px SemiBold
H3: 24px SemiBold
Body: 16px Regular
```

## 🔘 Common Components

### Primary Button
```jsx
import { getPrimaryButtonClasses } from '@/lib/brandGuidelines'

<button className={getPrimaryButtonClasses()}>
  Get Started
</button>

// Or use Tailwind directly:
<button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-all">
  Get Started
</button>
```

### Secondary Button
```jsx
import { getSecondaryButtonClasses } from '@/lib/brandGuidelines'

<button className={getSecondaryButtonClasses()}>
  Learn More
</button>
```

### Card
```jsx
import { getCardClasses } from '@/lib/brandGuidelines'

<div className={getCardClasses()}>
  {/* Card content */}
</div>

// Or use Tailwind:
<div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
  {/* Card content */}
</div>
```

### Input Field
```jsx
import { getInputClasses } from '@/lib/brandGuidelines'

<input
  type="text"
  className={getInputClasses()}
  placeholder="Enter text..."
/>
```

### Badges
```jsx
import { getBadgeClasses } from '@/lib/brandGuidelines'

<span className={getBadgeClasses('sale')}>Sale</span>
<span className={getBadgeClasses('success')}>Success</span>
<span className={getBadgeClasses('info')}>Info</span>
<span className={getBadgeClasses('warning')}>Warning</span>
```

## 📏 Spacing (8px scale)

```typescript
XS:  4px   - Tight spacing
SM:  8px   - Small gaps
MD:  16px  - Default spacing
LG:  24px  - Section spacing
XL:  32px  - Large gaps
2XL: 48px  - Section padding
3XL: 64px  - Major sections
4XL: 96px  - Hero sections
```

## 🎭 Gradients

```jsx
import { GRADIENTS } from '@/lib/brandGuidelines'

// Primary gradient
<div style={{ background: GRADIENTS.primary }}>
  {/* Content */}
</div>

// Hero gradient
<div style={{ background: GRADIENTS.hero }}>
  {/* Content */}
</div>
```

## 📱 Responsive Breakpoints

```typescript
sm:  640px  - Small devices
md:  768px  - Tablets
lg:  1024px - Laptops
xl:  1280px - Desktops
2xl: 1536px - Large screens
```

## 💬 Recommended CTAs

- "Discover"
- "Transform"
- "Get Started"
- "Secure Your Business"
- "Shop Now"
- "Learn More"
- "Explore Solutions"

## ✅ Quick Checklist

Before deploying any component:

- [ ] Uses approved colors from palette
- [ ] Uses Poppins for headings, Roboto for body
- [ ] Follows 8px spacing scale
- [ ] Has proper hover/focus states
- [ ] Meets WCAG AA contrast (4.5:1)
- [ ] Responsive on mobile/tablet/desktop
- [ ] Uses consistent border radius (8px)
- [ ] Has proper loading/error states

## 🔗 Full Documentation

For complete guidelines, see:
- `/lib/brandGuidelines.ts` - All constants and helpers
- `/BRAND_GUIDELINES.md` - Complete documentation
- `/brand-guidelines` - Visual showcase page

## 📞 Support

Questions? Contact the design team or refer to the full brand guidelines documentation.
