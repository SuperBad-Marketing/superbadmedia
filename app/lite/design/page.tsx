import type { Metadata } from "next";

import {
  brand,
  motion,
  neutral,
  radius,
  semantic,
  space,
  surface,
  THEME_PRESETS,
  TYPEFACE_PRESETS,
  typography,
  type ThemePreset,
  type TypefacePreset,
} from "@/lib/design-tokens";
import { getActivePresets } from "@/lib/presets";

import { setThemePreset, setTypefacePreset } from "./actions";
import { PrimitivesGallery } from "./primitives-gallery";
import { A11yPanel } from "./a11y-panel";

export const metadata: Metadata = {
  title: "SuperBad — Design Baseline",
  robots: { index: false, follow: false },
};

/**
 * /lite/design — internal reference route for the design system.
 * (BUILD_PLAN §R named this `/lite/_design` but Next.js App Router treats
 * `_foo` as a private folder — underscore dropped.)
 *
 * Admin gate is stubbed for now; real role check lands in A8 with the
 * Brand DNA Gate middleware + portal-guard primitive. The route is
 * excluded from search indexes in the meantime via `robots`.
 */
export default async function DesignPage() {
  const { theme, typeface } = await getActivePresets();

  return (
    <main
      className="min-h-full"
      style={{ padding: `var(--space-6)`, gap: `var(--space-6)` }}
    >
      <header className="flex flex-col gap-2 mb-10">
        <p
          className="uppercase tracking-[0.12em]"
          style={{
            fontFamily: "var(--font-label)",
            fontSize: "var(--text-micro)",
            color: "var(--neutral-500)",
          }}
        >
          SuperBad · internal · design baseline
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-h1)",
            lineHeight: "var(--text-h1-lh)",
            color: "var(--neutral-100)",
          }}
        >
          Design baseline
        </h1>
        <p
          style={{
            fontFamily: "var(--font-narrative)",
            fontSize: "var(--text-narrative)",
            lineHeight: "var(--text-narrative-lh)",
            color: "var(--neutral-300)",
            fontStyle: "italic",
            maxWidth: "64ch",
          }}
        >
          Every token lives here first. If it&apos;s not on this page, it
          probably shouldn&apos;t exist yet.
        </p>
      </header>

      <Section title="Theme preset">
        <p className="opacity-70" style={{ fontSize: "var(--text-small)" }}>
          Active:{" "}
          <code style={{ fontFamily: "var(--font-label)" }}>{theme}</code>
        </p>
        <form className="flex flex-wrap gap-2 mt-3" action={setThemePreset}>
          {THEME_PRESETS.map((value) => (
            <PresetButton
              key={value}
              name="preset"
              value={value}
              active={value === theme}
            />
          ))}
        </form>
      </Section>

      <Section title="Typeface preset">
        <p className="opacity-70" style={{ fontSize: "var(--text-small)" }}>
          Active:{" "}
          <code style={{ fontFamily: "var(--font-label)" }}>{typeface}</code>
        </p>
        <form className="flex flex-wrap gap-2 mt-3" action={setTypefacePreset}>
          {TYPEFACE_PRESETS.map((value) => (
            <PresetButton
              key={value}
              name="preset"
              value={value}
              active={value === typeface}
            />
          ))}
        </form>
      </Section>

      <Section title="Neutral scale">
        <Swatches items={Object.entries(neutral).map(([k, v]) => [`neutral-${k}`, v])} />
      </Section>

      <Section title="Brand tokens">
        <Swatches items={Object.entries(brand).map(([k, v]) => [`brand-${k}`, v])} />
      </Section>

      <Section title="Semantic tokens">
        <Swatches items={Object.entries(semantic).map(([k, v]) => [k, v])} />
      </Section>

      <Section title="Surfaces (elevated, inner highlight)">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(surface).map(([k, v]) => (
            <div
              key={k}
              style={{
                background: v,
                borderRadius: `var(--radius-default)`,
                padding: `var(--space-5)`,
                boxShadow: "var(--surface-highlight)",
                border: "1px solid var(--neutral-600)",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: "var(--text-micro)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--neutral-500)",
                }}
              >
                surface-{k}
              </p>
              <p style={{ color: "var(--neutral-300)", marginTop: "var(--space-1)" }}>
                {v as string}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="flex flex-col gap-3">
          <Sample role="display" sample="SuperBad" />
          <Sample role="h1" sample="Welcome back." />
          <Sample role="h2" sample="Pipeline overview" />
          <Sample role="h3" sample="Active deals this week" />
          <Sample role="body" sample="Default body text. DM Sans (or the active preset) at 16 / 1.5." />
          <Sample role="narrative" sample="Italic narrative voice — the morning brief register." />
          <Sample role="small" sample="Secondary text — metadata, helper copy." />
          <Sample role="micro" sample="LABEL — RIGHTEOUS UPPERCASE MICRO" />
        </div>
      </Section>

      <Section title="Spacing scale">
        <div className="flex flex-col gap-2">
          {Object.entries(space).map(([k, v]) => (
            <div key={k} className="flex items-center gap-3">
              <span
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: "var(--text-micro)",
                  color: "var(--neutral-500)",
                  width: "4rem",
                }}
              >
                space-{k}
              </span>
              <span
                style={{
                  height: "12px",
                  background: "var(--brand-pink)",
                  width: `${v}px`,
                  borderRadius: "var(--radius-tight)",
                }}
              />
              <span style={{ color: "var(--neutral-500)", fontSize: "var(--text-small)" }}>
                {v}px
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Radius">
        <div className="flex flex-wrap gap-3">
          {Object.entries(radius).map(([k, v]) => (
            <div
              key={k}
              style={{
                background: "var(--surface-1)",
                borderRadius: `${v}px`,
                padding: `var(--space-5)`,
                width: "8rem",
                textAlign: "center",
                boxShadow: "var(--surface-highlight)",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: "var(--text-micro)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--neutral-500)",
                }}
              >
                {k}
              </p>
              <p style={{ color: "var(--neutral-300)", marginTop: "var(--space-1)" }}>{v}px</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Motion constants">
        <ul
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-small)",
            color: "var(--neutral-300)",
            lineHeight: 1.7,
          }}
        >
          <li>
            Tier 1 spring — stiffness {motion.tier1Spring.stiffness}, damping{" "}
            {motion.tier1Spring.damping}, mass {motion.tier1Spring.mass}. Default
            interaction.
          </li>
          <li>Tier 1 CSS fallback — {motion.tier1DurationMs}ms {motion.tier1Ease}.</li>
          <li>
            Tier 2 slow-out — {motion.tier2SlowMs}ms {motion.tier2Ease}. Morning
            brief / quote-accept.
          </li>
          <li>Reduced-motion substitute — {motion.reducedDurationMs}ms linear ease-out.</li>
        </ul>
      </Section>

      <Section title="Focus ring preview">
        <button
          type="button"
          style={{
            background: "var(--accent-cta)",
            color: "var(--accent-cta-fg)",
            padding: "var(--space-3) var(--space-5)",
            borderRadius: "var(--radius-tight)",
            fontFamily: "var(--font-label)",
            fontSize: "var(--text-micro)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Primary CTA · tab to see ring
        </button>
      </Section>

      <Section title="Component primitives (A3)">
        <PrimitivesGallery />
      </Section>

      <Section title="Accessibility variants (A3 — 10 locked axes)">
        <A11yPanel />
      </Section>

      <Section title="Typography sample — 3-preset sentence">
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body)",
            color: "var(--neutral-300)",
          }}
        >
          Current body: the active typeface preset&apos;s body face.
        </p>
        <p
          style={{
            fontFamily: "var(--font-narrative)",
            fontSize: "var(--text-narrative)",
            color: "var(--neutral-300)",
            fontStyle: "italic",
          }}
        >
          Current narrative: the active typeface preset&apos;s narrative face.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        marginBottom: "var(--space-7)",
        paddingBottom: "var(--space-5)",
        borderBottom: "1px solid var(--neutral-600)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-label)",
          fontSize: "var(--text-micro)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--neutral-500)",
          marginBottom: "var(--space-3)",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Swatches({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {items.map(([k, v]) => (
        <div
          key={k}
          style={{
            border: "1px solid var(--neutral-600)",
            borderRadius: "var(--radius-default)",
            overflow: "hidden",
          }}
        >
          <div style={{ background: v, height: 56 }} />
          <div style={{ padding: "var(--space-2) var(--space-3)" }}>
            <p
              style={{
                fontFamily: "var(--font-label)",
                fontSize: "var(--text-micro)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--neutral-500)",
              }}
            >
              {k}
            </p>
            <p style={{ color: "var(--neutral-300)", fontSize: "var(--text-small)" }}>{v}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PresetButton({
  name,
  value,
  active,
}: {
  name: string;
  value: ThemePreset | TypefacePreset;
  active: boolean;
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      style={{
        fontFamily: "var(--font-label)",
        fontSize: "var(--text-micro)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        padding: "var(--space-2) var(--space-4)",
        borderRadius: "var(--radius-tight)",
        background: active ? "var(--accent-cta)" : "var(--surface-2)",
        color: active ? "var(--accent-cta-fg)" : "var(--neutral-300)",
        border: "1px solid var(--neutral-600)",
        cursor: "pointer",
      }}
    >
      {value}
    </button>
  );
}

function Sample({ role, sample }: { role: keyof typeof typography; sample: string }) {
  const isDisplay = role === "display" || role === "h1";
  const isNarrative = role === "narrative";
  const isMicro = role === "micro";
  const fontFamily = isDisplay
    ? "var(--font-display)"
    : isNarrative
      ? "var(--font-narrative)"
      : isMicro
        ? "var(--font-label)"
        : "var(--font-body)";

  return (
    <div className="flex flex-col gap-1">
      <span
        style={{
          fontFamily: "var(--font-label)",
          fontSize: "var(--text-micro)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--neutral-500)",
        }}
      >
        {role} · {typography[role].size}px / {typography[role].lineHeight}
      </span>
      <span
        style={{
          fontFamily,
          fontSize: `var(--text-${role})`,
          lineHeight: `var(--text-${role}-lh)`,
          color: "var(--neutral-100)",
          fontStyle: isNarrative ? "italic" : undefined,
          textTransform: isMicro ? "uppercase" : undefined,
          letterSpacing: isMicro ? "0.12em" : undefined,
        }}
      >
        {sample}
      </span>
    </div>
  );
}
