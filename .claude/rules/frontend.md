---
paths:
  - "client/src/**/*.ts"
  - "client/src/**/*.css"
  - "client/index.html"
---

# Frontend

## Design Tokens

Design tokens live in `client/src/theme/tokens.ts` (and the CSS vars it applies via `applyThemeCssVariables`). Reuse them — never hardcode raw colors/spacing in scenes, the DOM lobby, or `style.css`.

Required token categories: colors (semantic names with dark mode variants), spacing scale, border radius, shadows (elevation system), typography (display + body + mono fonts, type scale, weights), breakpoints, transitions (durations + easing), z-index scale.

## Design Principles

Pick one primary principle. Don't mix randomly.

| Principle | When to use |
|---|---|
| **Glassmorphism** | Overlays, modern dashboards |
| **Neumorphism** | Settings panels, minimal controls |
| **Brutalism** | Developer tools, editorial sites |
| **Minimalism** | Portfolios, documentation, content-first |
| **Maximalism** | Creative agencies, e-commerce |
| **Claymorphism** | Playful apps, onboarding |
| **Bento Grid** | Dashboards, feature showcases |
| **Aurora / Mesh Gradients** | Landing pages, hero sections |
| **Flat Design** | Mobile apps, system UI |
| **Material Elevation** | Data-heavy apps, enterprise |
| **Editorial** | Blogs, long-form content |

## Component Framework

This project uses **no UI framework**. Stick to what's here — don't introduce React/Vue or a component/CSS library.

| Category | This project uses |
|---|---|
| Lobby/UI | Plain DOM built in TS (`client/src/ui/`) + vanilla CSS (`client/src/style.css`) |
| Game | Phaser 3 canvas (`client/src/scenes/`), lazy-loaded on match start |
| Animation | CSS transitions (DOM) / Phaser tweens (canvas) — `transform`/`opacity` only |
| State sync | `socket.io-client` to the `server/` package |

## Layout

- CSS Grid for 2D, Flexbox for 1D. Use `gap`, not margin hacks.
- Semantic HTML: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`.
- Mobile-first. Touch targets: minimum 44x44px.

## Accessibility (non-negotiable)

- All interactive elements keyboard-accessible.
- Images: meaningful `alt` text. Decorative: `alt=""`.
- Form inputs: associated `<label>` or `aria-label`.
- Contrast: 4.5:1 normal text, 3:1 large text.
- Visible focus indicators. Never `outline: none` without replacement.
- Color never the sole indicator.
- `aria-live` for dynamic content. Respect `prefers-reduced-motion` and `prefers-color-scheme`.

## Performance

- Images: `loading="lazy"` below fold, explicit `width`/`height`.
- Fonts: `font-display: swap`.
- Animations: `transform` and `opacity` only.
- Large lists: virtualize at 100+ items.
- Bundle size: never import a whole library for one function.
