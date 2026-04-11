# Design System Architect Skill

Source: https://github.com/wilwaldon/Claude-Code-Frontend-Design-Toolkit (design-tokens section)

Use this skill when:
- Setting up or refactoring the colour/typography system in superbad-hq
- Adding a new colour to the palette
- Implementing dark mode
- Ensuring consistent spacing or type scale across components

superbad-hq uses Tailwind CSS v4 with Next.js. This skill targets the `@theme` block in CSS.

## Colour System — Use OKLCH

Always define brand colours in `oklch` space, not hex or hsl. OKLCH produces perceptually uniform colours and smooth gradients.

```css
/* In globals.css — @theme block */
@theme {
  /* SuperBad brand palette */
  --color-brand:      oklch(38% 0.14 5);     /* #B22848 SuperBad Red */
  --color-surface:    oklch(13% 0.005 90);    /* #1A1A18 Dark Charcoal */
  --color-text:       oklch(96% 0.015 80);    /* #FDF5E6 Warm Cream */
  --color-accent:     oklch(67% 0.13 45);     /* #F28C52 Retro Orange */
  --color-pink:       oklch(72% 0.09 5);      /* #F4A0B0 Retro Pink */

  /* Semantic aliases — use these in components */
  --color-background:       var(--color-surface);
  --color-foreground:       var(--color-text);
  --color-primary:          var(--color-brand);
  --color-primary-hover:    oklch(from var(--color-brand) calc(l + 0.05) c h);
  --color-muted:            oklch(from var(--color-text) l c h / 0.4);
  --color-border:           oklch(from var(--color-text) l c h / 0.1);
}
```

**Why OKLCH:**
- Lightness is perceptually uniform (L=50 looks the same across all hues)
- Smooth gradients without muddy midpoints
- Easy to create tints/shades by adjusting L only
- `oklch(from <base> calc(l + 0.1) c h)` syntax for relative colour

## Typography Scale

```css
@theme {
  /* Type scale — use rem, based on 16px root */
  --text-xs:   0.75rem;   /* 12px — labels, captions */
  --text-sm:   0.875rem;  /* 14px — secondary body */
  --text-base: 1rem;      /* 16px — primary body */
  --text-lg:   1.125rem;  /* 18px — lead text */
  --text-xl:   1.25rem;   /* 20px — small headings */
  --text-2xl:  1.5rem;    /* 24px */
  --text-3xl:  1.875rem;  /* 30px */
  --text-4xl:  2.25rem;   /* 36px */
  --text-5xl:  3rem;      /* 48px — display */
  --text-6xl:  3.75rem;   /* 60px — hero */
  --text-7xl:  4.5rem;    /* 72px — max display */
}
```

## Spacing System — 4pt Grid

```css
@theme {
  --spacing-1:  0.25rem;   /* 4px */
  --spacing-2:  0.5rem;    /* 8px */
  --spacing-3:  0.75rem;   /* 12px */
  --spacing-4:  1rem;      /* 16px */
  --spacing-6:  1.5rem;    /* 24px */
  --spacing-8:  2rem;      /* 32px */
  --spacing-10: 2.5rem;    /* 40px */
  --spacing-12: 3rem;      /* 48px */
  --spacing-16: 4rem;      /* 64px */
  --spacing-20: 5rem;      /* 80px */
  --spacing-24: 6rem;      /* 96px */
}
```

## Z-Index Scale — Never Use Arbitrary Values

```css
@theme {
  --z-base:    0;
  --z-raised:  10;
  --z-overlay: 20;
  --z-modal:   40;
  --z-toast:   100;
  --z-max:     1000;
}
```

## Dark Mode Setup (Tailwind v4)

```css
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Light mode defaults */
  --color-background: oklch(98% 0.005 80);
  --color-foreground: oklch(13% 0.005 90);
}

.dark {
  --color-background: oklch(13% 0.005 90);
  --color-foreground: oklch(96% 0.015 80);
}
```

## Component Token Pattern

In every component, reference tokens — never raw values:

```tsx
// ✅ Correct
<div className="bg-[var(--color-background)] text-[var(--color-foreground)]" />

// ❌ Wrong
<div className="bg-[#1A1A18] text-[#FDF5E6]" />
```

## Responsive Breakpoints (superbad-hq)

```css
@theme {
  --breakpoint-sm:   375px;   /* mobile */
  --breakpoint-md:   768px;   /* tablet */
  --breakpoint-lg:   1024px;  /* desktop */
  --breakpoint-xl:   1280px;  /* wide */
  --breakpoint-2xl:  1440px;  /* max content width */
}
```

Content max-width: `max-w-7xl` (1280px) on desktop. Always mobile-first.

## Design Token Audit Checklist

Before delivering any UI work:
- [ ] No hardcoded hex values in component files
- [ ] All colours reference `--color-*` tokens
- [ ] All font sizes from the defined scale
- [ ] All spacing from the 4pt grid
- [ ] All z-index values from the defined scale
- [ ] Dark mode tested — not just inferred from light mode
- [ ] Contrast checked: body text ≥4.5:1, secondary text ≥3:1
