"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

/**
 * A11yPanel — manual verification surface for the 10 A3 accessibility variants.
 *
 * Each toggle flips a `data-*` attribute on <html> so the whole tree
 * re-renders under the new variant. Not a persisted preference — persistence
 * lands with the Settings → Display panel post-A8. Here it exists purely to
 * walk the primitives through the 10 locked variants per the spec.
 *
 * Variants covered:
 *   1. reduced-motion  (data-motion="reduced")
 *   2. sounds-off      (data-sounds="off")
 *   3. large-text      (data-text-size="large")
 *   4. compact         (data-density="compact")
 *   5. contrast        (data-contrast="high")
 *   6. keyboard        (documented — user tabs)
 *   7. focus-visible   (data-focus="always")
 *   8. screen-reader   (documented — all primitives ship aria)
 *   9. aria-live toast (verified by firing a toast from the gallery)
 *  10. prefers-reduced-motion parity (OS-level — browser DevTools)
 */
type Axis = {
  id: string
  attr: string
  value: string
  label: string
  hint: string
}

const AXES: Axis[] = [
  {
    id: "motion",
    attr: "data-motion",
    value: "reduced",
    label: "Reduced motion",
    hint: "Strips Tier 1 + Tier 2 animation; OS prefers-reduced-motion parity.",
  },
  {
    id: "sounds",
    attr: "data-sounds",
    value: "off",
    label: "Sounds off",
    hint: "Every play() becomes a no-op; A4 registry will honour this.",
  },
  {
    id: "text-size",
    attr: "data-text-size",
    value: "large",
    label: "Large text",
    hint: "body 16→18 · small 14→16 · headings scale with viewport.",
  },
  {
    id: "density",
    attr: "data-density",
    value: "compact",
    label: "Compact density",
    hint: "Tightens paddings; AdminShell sidebar 240→200.",
  },
  {
    id: "contrast",
    attr: "data-contrast",
    value: "high",
    label: "High contrast",
    hint: "Reserved — honoured by per-feature contrast passes.",
  },
  {
    id: "focus",
    attr: "data-focus",
    value: "always",
    label: "Focus-visible forced",
    hint: "Forces focus rings to render on mouse click too.",
  },
]

export function A11yPanel() {
  const [state, setState] = React.useState<Record<string, boolean>>({})

  const toggle = (axis: Axis) => {
    const next = !state[axis.id]
    setState((s) => ({ ...s, [axis.id]: next }))
    if (typeof document !== "undefined") {
      if (next) {
        document.documentElement.setAttribute(axis.attr, axis.value)
      } else {
        document.documentElement.removeAttribute(axis.attr)
      }
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {AXES.map((axis) => (
        <div
          key={axis.id}
          className="flex items-start gap-3 rounded-md border border-[color:var(--neutral-600)] p-4"
        >
          <Switch
            id={`a11y-${axis.id}`}
            checked={!!state[axis.id]}
            onCheckedChange={() => toggle(axis)}
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor={`a11y-${axis.id}`} className="text-sm">
              {axis.label}
            </Label>
            <span
              className="text-xs"
              style={{ color: "var(--neutral-500)" }}
            >
              {axis.hint}
            </span>
          </div>
        </div>
      ))}

      <div className="md:col-span-2 flex flex-col gap-2 rounded-md border border-dashed border-[color:var(--neutral-600)] p-4">
        <span
          className="uppercase tracking-wider text-xs"
          style={{ color: "var(--neutral-500)", fontFamily: "var(--font-label)" }}
        >
          Keyboard-only check
        </span>
        <p className="text-sm" style={{ color: "var(--neutral-300)" }}>
          Tab through the gallery above. Every focusable primitive must show a
          visible ring without using the mouse. Escape closes every overlay.
        </p>
        <div>
          <Button
            variant="outline"
            onClick={() => {
              if (typeof document !== "undefined") {
                const focusables = document.querySelectorAll<HTMLElement>(
                  "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
                )
                focusables[0]?.focus()
              }
            }}
          >
            Start keyboard walk
          </Button>
        </div>
      </div>
    </div>
  )
}
