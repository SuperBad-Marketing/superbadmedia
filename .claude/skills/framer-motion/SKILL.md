# Framer Motion Skill (for Next.js / React)

Source: https://github.com/jezweb/claude-skills + https://github.com/wilwaldon/Claude-Code-Frontend-Design-Toolkit

Use this skill for any animation work in superbad-hq. This project uses `motion/react` (the new package name for Framer Motion v11+).

**Import:** `import { motion, AnimatePresence, useScroll, useTransform, useSpring } from "motion/react"`

## Core Patterns

### Basic Enter Animation
```tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
/>
```

### Exit Animations — Always Use AnimatePresence
```tsx
<AnimatePresence mode="wait">
  {isVisible && (
    <motion.div
      key="panel"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}  // exit is subtler than enter
      transition={{ duration: 0.25, ease: [0.4, 0, 1, 1] }}
    />
  )}
</AnimatePresence>
```

### Staggered List
```tsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.1 }
  }
}
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }
}

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map(i => <motion.li key={i.id} variants={item} />)}
</motion.ul>
```

### Button Press Feedback
```tsx
<motion.button
  whileTap={{ scale: 0.97 }}
  transition={{ duration: 0.1 }}
>
```

### Layout Transitions (FLIP)
```tsx
// Same layoutId enables smooth transition between different components
<motion.div layoutId="card-image" />
```

### Scroll-Triggered Animation
```tsx
const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
const opacity = useTransform(scrollYProgress, [0, 0.3], [0, 1])
const y = useTransform(scrollYProgress, [0, 0.3], [20, 0])

<motion.div style={{ opacity, y }} />
```

### Spring for Interactive Elements
```tsx
// Use spring physics for draggable/interactive elements
const springConfig = { stiffness: 400, damping: 30, mass: 0.8 }
<motion.div drag dragElastic={0.1} dragMomentum={false}
  transition={{ type: "spring", ...springConfig }} />
```

## Reduced Motion — Always Required

```tsx
import { useReducedMotion } from "motion/react"

function AnimatedComponent() {
  const shouldReduce = useReducedMotion()
  return (
    <motion.div
      animate={{ opacity: 1, y: shouldReduce ? 0 : -8 }}
      transition={{ duration: shouldReduce ? 0 : 0.3 }}
    />
  )
}
```

## Easing Reference

| Use case | Curve |
|---|---|
| Element entering view | `[0.22, 1, 0.36, 1]` — fast start, graceful land |
| Element leaving view | `[0.4, 0, 1, 1]` — fast, clean departure |
| Interactive spring | `{ type: "spring", bounce: 0 }` |
| Refined spring | `{ stiffness: 400, damping: 30 }` |

Never use `"linear"` or `"easeInOut"` — always use custom curves.

## Duration Reference

| Interaction type | Duration |
|---|---|
| Micro (press, hover, icon swap) | 100–150ms |
| Small UI (tooltip, badge, chip) | 150–200ms |
| Component (modal, drawer, panel) | 250–350ms |
| Page transition | 300–450ms |
| High-frequency action | 0ms — skip animation entirely |

## What NOT to Animate

- `width`, `height`, `top`, `left`, `margin`, `padding` — causes reflow
- Elements triggered by keyboard shortcuts
- Actions performed hundreds of times per day
- `background-color` on large surfaces

## Page Transitions in Next.js App Router

```tsx
// In a shared layout component
<AnimatePresence mode="wait">
  <motion.main
    key={pathname}
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.main>
</AnimatePresence>
```
