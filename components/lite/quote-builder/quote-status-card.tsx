import * as React from "react";

export type QuoteStatusCardVariant = "expired" | "withdrawn" | "superseded" | "accepted";

export type QuoteStatusCardProps = {
  variant: QuoteStatusCardVariant;
  /** For `superseded`, the token of the new active quote (if known). */
  supersededByToken?: string | null;
  /** For `accepted`, the date the client accepted (ms since epoch). */
  acceptedAtMs?: number | null;
};

const COPY: Record<
  QuoteStatusCardVariant,
  { headline: string; body: string; cta?: { label: string; href: string } | null }
> = {
  expired: {
    headline: "This quote has expired.",
    body: "Still interested? Drop Andy a line.",
    cta: { label: "andy@superbadmedia.com.au", href: "mailto:andy@superbadmedia.com.au" },
  },
  withdrawn: {
    headline: "This quote is no longer active.",
    body: "If that's a surprise, andy@superbadmedia.com.au is the address.",
    cta: null,
  },
  superseded: {
    headline: "There's a newer version.",
    body: "This one's been replaced. The new quote has the latest pricing.",
    cta: null,
  },
  accepted: {
    headline: "Already accepted. Thanks.",
    body: "Andy's got it from here. Check your inbox for what's next.",
    cta: null,
  },
};

export function QuoteStatusCard(props: QuoteStatusCardProps) {
  const copy = COPY[props.variant];
  const supersedeHref = props.supersededByToken
    ? `/lite/quotes/${props.supersededByToken}`
    : null;

  return (
    <main
      className="flex min-h-screen items-center justify-center px-6"
      style={{
        backgroundColor: "var(--brand-cream)",
        color: "var(--brand-charcoal)",
        fontFamily: "var(--font-body)",
      }}
    >
      <div className="max-w-md text-center">
        <div
          className="text-[10px] uppercase tracking-[0.24em]"
          style={{ color: "color-mix(in srgb, var(--brand-charcoal) 55%, transparent)" }}
        >
          SuperBad
        </div>
        <h1
          className="mt-4 text-3xl leading-tight md:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {copy.headline}
        </h1>
        <p
          className="mt-4 text-base italic"
          style={{ fontFamily: "var(--font-narrative)" }}
        >
          {copy.body}
        </p>

        {props.variant === "superseded" && supersedeHref && (
          <a
            href={supersedeHref}
            className="mt-8 inline-block rounded-md px-6 py-3 text-base font-medium text-white"
            style={{ backgroundColor: "var(--brand-red)" }}
          >
            See the current version →
          </a>
        )}

        {copy.cta && (
          <p className="mt-8">
            <a
              href={copy.cta.href}
              className="text-base underline underline-offset-4"
              style={{ color: "var(--brand-red)" }}
            >
              {copy.cta.label}
            </a>
          </p>
        )}

        {props.variant === "accepted" && props.acceptedAtMs && (
          <p
            className="mt-6 text-xs"
            style={{ color: "color-mix(in srgb, var(--brand-charcoal) 55%, transparent)" }}
          >
            Accepted {new Date(props.acceptedAtMs).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
      </div>
    </main>
  );
}
