---
name: sacs-brand
description: Apply SACS brand identity and design system to all frontend work. Use when creating or modifying any UI component, page, or visual element.
---

# SACS Brand Identity & Design System

Before writing ANY frontend code, read and follow the full style guide at `assets/branding/STYLE_GUIDE.md` and the design tokens in `sitio/src/styles/global.css`.

## Critical Rules (NEVER break these)

1. **NEVER use gradients on buttons or CTAs** — always solid colors (Blue #4B7BE5 for primary)
2. **Buttons are always pill-shaped** — `border-radius: 50px`
3. **Hero titles use Space Grotesk Bold** — never Plus Jakarta Sans for display text
4. **Body text uses Plus Jakarta Sans** — never Space Grotesk for body
5. **Minimum body text size: 16px** on desktop
6. **Background is never pure white** — use #FAFAF8 (Blanco Roto) or #F5F3EE (Crema Calido)
7. **Always respect `prefers-reduced-motion`**
8. **All spacing derives from 8px base** — use the --space-* tokens

## Color Palette

```
Primary (CTAs, links):     #4B7BE5
Secondary (growth):        #2AB5A0
Accent (highlights):       #E8A838
Error:                     #E54B4B

Text Primary:              #1A1A1A
Text Secondary:            #4A4A4A
Text Tertiary:             #8C8C8C

Background Primary:        #FAFAF8
Background Secondary:      #F5F3EE
Background Cards:          #FFFFFF
Background Dark:           #1A1A1A
```

## Typography

- **Display XL (Hero):** Space Grotesk 700, 80px→44px, line-height 0.95, letter-spacing -0.04em
- **Display L:** Space Grotesk 700, 64px→36px, line-height 1.0
- **H1:** Plus Jakarta Sans 700, 48px→32px
- **H2:** Plus Jakarta Sans 600, 36px→28px
- **H3:** Plus Jakarta Sans 600, 28px→22px
- **Body Large:** Plus Jakarta Sans 400, 20px→18px
- **Body:** Plus Jakarta Sans 400, 16px
- **Eyebrow:** Plus Jakarta Sans 600, 13px→12px, uppercase, letter-spacing 0.12em

## Component Standards

### Buttons
- Primary: bg #4B7BE5, white text, pill shape, hover scale(1.03)
- Secondary: transparent, 1.5px solid #1A1A1A border, pill shape
- Ghost: transparent, #4B7BE5 text
- CTA Premium: bg #4B7BE5 SOLID (NO gradient), shadow 0 4px 14px rgba(75,123,229,0.3)
- Padding: 14px 28px (default), 10px 20px (small), 18px 36px (large)

### Cards
- White background, 1px border rgba(0,0,0,0.08), border-radius 16px
- Padding 32px, hover: shadow + translateY(-2px)
- Feature cards: bg #FAFAF8, border-radius 20px, padding 40px

### Navigation
- Height 72px, sticky, backdrop-blur on scroll
- Logo 32px height, links 15px Medium weight
- Mobile: hamburger → full-screen overlay

## Animation Principles
- Fade In Up: opacity 0→1, translateY(20px→0), 600ms, staggered 100ms
- Scale In: opacity 0→1, scale(0.95→1), 400ms
- Text Reveal: line-by-line mask, 800ms per line
- Counter Up: 1500ms, ease-out
- Easing: cubic-bezier(0.25, 0.1, 0.25, 1) default

## Illustration Style
- Painterly/vintage digital — NOT flat, NOT 3D
- Mexican aquatic themes: Xochimilco, axolotls, lirios
- Always use overlays for text legibility over illustrations
- AXO mascot: artistic illustration, never cartoon/flat/3D

## Layout
- Max-width: 1280px, 12-column grid
- Section padding: 64px (mobile) → 80px (tablet) → 96px (desktop)
- Hero padding: 128-160px top
- Container padding: 20px (mobile) → 40px (tablet) → 64px (desktop)

## Before Generating Images (Nano Banana / AI)
When generating images with AI tools for SACS:
- Request painterly/vintage style with visible brushstrokes
- Use the brand color palette (blues, teals, corals, golds)
- Include Mexican aquatic/botanical themes when relevant
- Specify warm lighting, like afternoon light over water
- Never request generic stock-photo style images

## Use the CSS custom properties from global.css
Always use `var(--token-name)` instead of hardcoded values. All tokens are defined in `sitio/src/styles/global.css`.
