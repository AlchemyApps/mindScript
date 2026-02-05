# MindScript Design System

## Design Philosophy: "Therapeutic Warmth"

MindScript's aesthetic is **meditation app meets creative studio** — calm but empowering, warm but professional. The design should feel like a soothing, holistic, therapeutic experience that guides users through creating personalized affirmation audio.

### Core Principles
- **Not:** Cold tech, generic SaaS, overwhelming options
- **Yes:** Warm gradients, gentle guidance, breathing animations, organic flow
- **Feel:** Soft, calming, supportive, professional

---

## Color Palette

### Primary Colors (from `packages/ui/src/tokens/index.ts`)

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#6C63FF` | Primary actions, links, active states |
| `accent` | `#10B981` | Success, completion, positive actions |
| `background` | `#F7F8FC` | Page backgrounds |
| `surface` | `#FFFFFF` | Cards, modals, elevated surfaces |
| `text` | `#0F172A` | Primary text |
| `soft` | `#FDE68A` | Warm highlights, special pricing |
| `muted` | `#6B7280` | Secondary text, placeholders |

### Extended Therapeutic Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary-light` | `#A5A0FF` | Hover states, gradients |
| `accent-light` | `#34D399` | Light accent variations |
| `warm-cream` | `#FDF8F3` | Warm background tints |
| `soft-lavender` | `#EDE9FE` | Soft purple backgrounds |
| `calm-mint` | `#D1FAE5` | Calming green accents |
| `deep-purple` | `#4C1D95` | Dark sections, contrast |
| `warm-gold` | `#D97706` | Premium/special indicators |
| `soft-pink` | `#FDF2F8` | Gentle pink accents |
| `ocean-blue` | `#0EA5E9` | Information, links |

### Gradients (Tailwind classes)

```
bg-warm-aura       - Soft tri-color (lavender → cream → mint)
bg-calm-purple     - Vertical lavender fade
bg-energy-glow     - Warm gold energy
bg-deep-space      - Dark purple (for contrast sections)
bg-sunrise         - Warm morning gradient
bg-ocean-calm      - Blue to mint calming
bg-hero-background - Full hero section gradient
```

---

## Typography

### Font Families
- **Headings:** `Sora` - Modern, clean, slightly playful
- **Body:** `Inter` - Highly readable, professional

### Usage Guidelines
- Hero headlines: `text-4xl md:text-5xl lg:text-6xl font-bold font-heading`
- Section headlines: `text-3xl md:text-4xl font-bold font-heading`
- Card titles: `text-lg font-semibold`
- Body text: `text-base` or `text-sm text-muted`
- Small/helper text: `text-xs text-muted`

### Gradient Text
```jsx
<span className="text-gradient">inner voice</span>      // Animated gradient
<span className="text-gradient-static">inner voice</span> // Static gradient
```

---

## Animations

### Tailwind Animation Classes

| Class | Duration | Usage |
|-------|----------|-------|
| `animate-breathe` | 4s | Hero elements, CTAs, important items |
| `animate-float` | 6s | Background orbs, decorative elements |
| `animate-float-delayed` | 6s (2s delay) | Staggered floating elements |
| `animate-float-slow` | 8s | Slow-moving background elements |
| `animate-shimmer` | 2s | Loading states |
| `animate-glow-pulse` | 3s | Glowing buttons, highlights |
| `animate-slide-up-fade` | 0.5s | Entry animations |
| `animate-scale-in` | 0.3s | Modal/dropdown entry |
| `animate-fade-in` | 0.2s | Subtle fade ins |

### Animation Principles
- Use `breathe` for important interactive elements
- Use `float` only for background decorations
- Entry animations should be subtle and quick (0.3-0.5s)
- Never animate text content directly
- Respect `prefers-reduced-motion` (TODO)

---

## Component Patterns

### Glass Morphism Cards
```jsx
<div className="glass rounded-2xl p-6">
  {/* Content */}
</div>

// CSS: bg-white/70, backdrop-blur, subtle border, soft shadow
```

### Hover Lift Effect
```jsx
<div className="hover-lift">
  {/* Lifts on hover with shadow */}
</div>
```

### Glow Effects
```jsx
<button className="glow-primary">Primary glow</button>
<button className="glow-accent">Accent glow</button>
<div className="glow-soft">Soft warm glow</div>
```

### Focus States
```jsx
<input className="focus-ring" />
// Applies primary-colored focus ring
```

### Badges/Pills
```jsx
// Section badge
<span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium">
  Badge Text
</span>

// Feature pill
<div className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/50 backdrop-blur-sm border border-white/30 text-sm">
  <Icon className="w-4 h-4 text-primary mr-1.5" />
  Label
</div>
```

### Feature Cards
```jsx
<div className="group p-6 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/50 hover-lift">
  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
    <Icon className="w-6 h-6" />
  </div>
  <h3 className="text-lg font-semibold text-text mb-2">Title</h3>
  <p className="text-muted text-sm">Description</p>
</div>
```

### Step Indicator
Located at `components/builder/StepIndicator.tsx`
- Supports horizontal and vertical orientation
- Shows completed (checkmark), current (pulsing), and upcoming states
- Clickable to navigate to previous steps

### Floating Orbs Background
```jsx
import { FloatingOrbs } from '@/components/landing/FloatingOrbs';

<div className="relative">
  <FloatingOrbs variant="hero" />   // Large, prominent
  <FloatingOrbs variant="subtle" /> // Small, background
  <FloatingOrbs variant="vibrant" /> // Colorful, energetic
  {/* Content */}
</div>
```

---

## Layout Patterns

### Page Structure
```jsx
<div className="flex min-h-screen flex-col bg-warm-gradient">
  <Header variant="transparent" /> {/* or "solid" */}
  <main className="flex-1">
    {/* Page content */}
  </main>
  <Footer />
</div>
```

### Section Spacing
- Between major sections: `py-16` to `py-20`
- Container: `container mx-auto px-4`
- Card padding: `p-4` to `p-6`
- Element spacing: Use Tailwind's `space-y-*` utilities

### Responsive Breakpoints
- Mobile first approach
- `md:` (768px) - Tablet layouts
- `lg:` (1024px) - Desktop layouts
- Grid patterns: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

---

## Icon Usage

Using `lucide-react` throughout. Common icons:

| Icon | Usage |
|------|-------|
| `Sparkles` | AI features, magic, enhancement |
| `AudioLines` | Voice/audio features |
| `Headphones` | Binaural beats, listening |
| `Waves` | Solfeggio frequencies |
| `Music` | Background music |
| `Check` | Completion, selection |
| `ChevronDown/Right` | Navigation, expansion |
| `Play/Pause` | Audio controls |

Icon sizing:
- In buttons: `w-4 h-4` or `w-5 h-5`
- Feature icons: `w-6 h-6`
- Hero icons: `w-8 h-8` or larger

---

## Form Elements

### Text Inputs
```jsx
<input
  className={cn(
    'w-full px-4 py-3 rounded-xl border-2 transition-all duration-200',
    'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10',
    'bg-white text-text placeholder:text-muted/50',
    hasError ? 'border-error/50' : 'border-gray-100'
  )}
/>
```

### Toggle Switches
```jsx
<button
  className={cn(
    'relative w-12 h-7 rounded-full transition-colors duration-200',
    enabled ? 'bg-primary' : 'bg-gray-200'
  )}
>
  <span className={cn(
    'absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm',
    enabled && 'translate-x-5'
  )} />
</button>
```

### Buttons
- Primary: `bg-primary hover:bg-primary/90 text-white`
- With glow: Add `glow-primary` class
- Ghost: `variant="ghost"` from UI package

---

## Builder-Specific Patterns

### Step Container (Glass Card)
```jsx
<div className="glass rounded-2xl shadow-lg overflow-hidden">
  <div className="px-6 pt-6">
    <StepIndicator steps={STEPS} currentStep={currentStep} />
  </div>
  <div className="p-6">
    {/* Step content */}
  </div>
  <div className="px-6 pb-6 pt-2 border-t border-gray-100">
    {/* Navigation buttons */}
  </div>
</div>
```

### Intention/Category Cards
- Grid: `grid-cols-2 md:grid-cols-3 gap-4`
- Each card has gradient icon, title, description
- Selected state: `border-primary bg-primary/5`

### Audio Selection Cards
- Include waveform visualization placeholder
- Play/preview button in corner
- Selected indicator (checkmark or border)

### Pricing Display
```jsx
<div className="p-4 rounded-xl bg-energy-glow/30 border border-soft">
  <p className="text-sm text-text">
    <span className="font-semibold">First track special!</span> ...
  </p>
</div>
```

---

## Files Created in This Session

### Design System
- `packages/ui/src/tokens/index.ts` - Extended with colors, gradients, shadows
- `apps/web/tailwind.config.js` - Animations, extended theme
- `apps/web/src/styles/globals.css` - Utility classes

### Components
- `apps/web/src/components/landing/FloatingOrbs.tsx`
- `apps/web/src/components/landing/HeroSection.tsx`
- `apps/web/src/components/navigation/Header.tsx`
- `apps/web/src/components/navigation/Footer.tsx`
- `apps/web/src/components/builder/StepIndicator.tsx`
- `apps/web/src/components/builder/StepBuilder.tsx`
- `apps/web/src/components/builder/steps/IntentionStep.tsx`
- `apps/web/src/components/builder/steps/ScriptStep.tsx`
- `apps/web/src/components/builder/steps/VoiceStep.tsx`
- `apps/web/src/components/builder/steps/EnhanceStep.tsx`
- `apps/web/src/components/builder/steps/CreateStep.tsx`

### Pages Modified
- `apps/web/src/app/page.tsx` - Complete landing page redesign

---

## TODO: Remaining Pages to Transform

### Priority 1: Authenticated Builder
- `apps/web/src/app/(authenticated)/builder/page.tsx`
- Apply same StepBuilder component
- Add template library sidebar
- Add save draft functionality

### Priority 2: Library
- Track cards with new design
- Waveform visualizations
- Glass-morphism containers
- Empty states with illustrations

### Priority 3: Audio Player
- Mini player with glass effect
- Full player modal
- Waveform progress visualization
- Breathing animation on play button

### Priority 4: Marketplace
- Enhanced TrackCard with category glow
- MarketplaceHero component
- Discovery sections (Trending, Staff Picks, By Mood)
- MoodGrid category browser

---

## Quick Reference: Common Patterns

```jsx
// Warm gradient background
<div className="bg-warm-gradient">

// Glass card
<div className="glass rounded-2xl p-6">

// Gradient text
<span className="text-gradient">highlighted text</span>

// Hover lift
<div className="hover-lift">

// Glow button
<button className="glow-primary">

// Floating orbs
<FloatingOrbs variant="hero" />

// Section badge
<span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">

// Feature card with gradient icon
<div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white">
```
