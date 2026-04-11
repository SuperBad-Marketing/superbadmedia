---
name: tailwind-v4
description: Tailwind CSS v4 syntax, breaking changes from v3, @theme directive, CSS-first config, and correct PostCSS setup. Apply to every component in superbad-hq — this project uses v4.
---

# Tailwind CSS v4 — SuperBad HQ Reference

superbad-hq uses **Tailwind CSS v4** with `@tailwindcss/postcss`. This is a breaking departure from v3. Every component must use v4 syntax only. Never write v3 syntax.

---

## 1. PostCSS Config (v4 — what's in this project)

```js
// postcss.config.mjs
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

**v3 syntax — NEVER write this:**
```js
// WRONG — v3
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} }
}
```

---

## 2. CSS Import (v4)

```css
/* globals.css */
@import "tailwindcss";
```

**NEVER write v3 directives:**
```css
/* WRONG — v3 */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 3. @theme Directive (CSS-first config)

In v4, design tokens live in CSS using `@theme`, not in `tailwind.config.js`. superbad-hq's design tokens are already declared as CSS variables — reference them via `@theme` if extending, and always consume via CSS variable syntax in components.

```css
@import "tailwindcss";

@theme {
  --color-sb-bg: #1A1A18;
  --color-sb-accent: #B22848;
  --color-sb-cream: #FDF5E6;
  --color-sb-card: #242422;
  --font-display: "Black Han Sans", sans-serif;
  --font-body: "DM Sans", sans-serif;
}
```

To use a theme variable as a Tailwind utility class:
```html
<!-- Uses --color-sb-accent defined in @theme -->
<div class="bg-sb-accent text-sb-cream"></div>
```

To use a CSS variable as an arbitrary value (v4 syntax):
```html
<!-- v4: parentheses, not square brackets -->
<div class="bg-(--sb-accent)"></div>

<!-- WRONG — v3 syntax -->
<div class="bg-[--sb-accent]"></div>
```

---

## 4. Renamed & Removed Utilities (v3 → v4)

| v3 (BANNED) | v4 (CORRECT) |
|---|---|
| `shadow-sm` | `shadow-xs` |
| `shadow` | `shadow-sm` |
| `drop-shadow-sm` | `drop-shadow-xs` |
| `blur-sm` | `blur-xs` |
| `rounded-sm` | `rounded-xs` |
| `outline-none` | `outline-hidden` |
| `ring` (3px solid blue) | `ring-3` |
| `flex-shrink-*` | `shrink-*` |
| `flex-grow-*` | `grow-*` |
| `bg-opacity-*` | `bg-black/50` (slash syntax) |
| `text-opacity-*` | `text-black/50` |
| `border-opacity-*` | `border-black/50` |
| `overflow-ellipsis` | `text-ellipsis` |

---

## 5. Default Value Changes

### Border color
v4 borders default to `currentColor`, not `gray-200`. **Always specify border color explicitly:**
```html
<!-- CORRECT in v4 -->
<div class="border border-sb-cream/20">

<!-- Will be invisible if you forget the color — v4 gotcha -->
<div class="border">
```

### Ring
v4 ring defaults to 1px + currentColor (not 3px + blue-500):
```html
<!-- v4: explicit -->
<input class="ring-3 ring-sb-accent focus:ring-3 focus:ring-sb-accent">
```

### Outline
v4: `outline-2` alone is sufficient (no need for `outline outline-2`):
```html
<button class="outline-2 outline-sb-accent outline-offset-2">
```

---

## 6. Important Modifier Position

```html
<!-- v4: ! goes AFTER the utility -->
<div class="flex! bg-sb-bg! hover:bg-sb-card!">

<!-- WRONG — v3 position -->
<div class="!flex !bg-sb-bg hover:!bg-sb-card">
```

---

## 7. Variant Stacking Order

```html
<!-- v4: left-to-right (outer variant first) -->
<ul class="*:first:pt-0 *:last:pb-0">

<!-- WRONG — v3 right-to-left -->
<ul class="first:*:pt-0 last:*:pb-0">
```

---

## 8. Arbitrary Values — Syntax Changes

```html
<!-- v4: parentheses for CSS variables -->
<div class="bg-(--brand-color)">

<!-- v4: underscores for spaces in multi-value utilities -->
<div class="grid-cols-[max-content_auto]">

<!-- WRONG — v3 comma syntax -->
<div class="grid-cols-[max-content,auto]">
```

---

## 9. Custom Utilities

```css
/* v4: @utility directive */
@utility sb-glass {
  background: rgba(36, 36, 34, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(253, 245, 230, 0.08);
}

/* WRONG — v3 @layer utilities */
@layer utilities {
  .sb-glass { ... }
}
```

---

## 10. Space & Divide — Use Gap Instead

v4 changed the selector logic for `space-y-*` / `space-x-*`. Always use flex/grid with `gap` instead:

```html
<!-- CORRECT — use gap -->
<div class="flex flex-col gap-4">

<!-- AVOID — space-y changed behaviour -->
<div class="space-y-4">
```

---

## 11. Transform Reset

```html
<!-- v4: reset individual transform properties -->
<button class="scale-150 focus:scale-none">

<!-- WRONG — v3 reset-all syntax -->
<button class="scale-150 focus:transform-none">
```

---

## 12. CSS Modules / Scoped Styles

Use `@reference` instead of importing the full stylesheet:
```css
/* Component.module.css */
@reference "../../app/globals.css";

.card {
  @apply bg-sb-card rounded-lg p-6;
}
```

---

## 13. Prefixes (if ever used)

```html
<!-- v4 prefix syntax looks like a variant -->
<div class="sb:flex sb:bg-sb-bg">
```

```css
@import "tailwindcss" prefix(sb);
```

---

## 14. Features Removed in v4 (do not use)

- `corePlugins` option — removed
- `resolveConfig()` — removed, use CSS variables
- `safelist` in JS config — use `@source` in CSS
- Sass/Less/Stylus compatibility — gone
- Auto-detection of `tailwind.config.js` — must explicitly load with `@config` if needed

---

## 15. Quick Checklist Before Submitting Any Component

- [ ] No `@tailwind base/components/utilities` directives
- [ ] PostCSS uses `@tailwindcss/postcss`, not `tailwindcss`
- [ ] Using `bg-black/50` not `bg-opacity-50`
- [ ] Using `shrink-*` not `flex-shrink-*`
- [ ] Using `shadow-xs` not `shadow-sm` for smallest shadow
- [ ] Using `outline-hidden` not `outline-none`
- [ ] `!important` modifier is AFTER the utility, not before
- [ ] CSS variable arbitrary values use `(--var)` not `[--var]`
- [ ] Border color always specified explicitly (no default gray)
- [ ] Ring uses `ring-3` not bare `ring` for 3px
- [ ] Custom utilities use `@utility`, not `@layer utilities`
- [ ] `gap` used instead of `space-y/x` wherever possible
