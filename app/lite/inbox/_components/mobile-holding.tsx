"use client";

/**
 * Mobile holding page for viewports < 900px. UI-11 ships the real
 * responsive inbox; for UI-8 we deliberately render a single centred
 * message instead of squeezing the three-column shell down.
 * Copy per spec §4.6 voice tone — dry, short, slow burn.
 */
export function MobileHolding() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-svh flex-col items-center justify-center gap-4 bg-[color:var(--color-background)] px-8 text-center"
    >
      <span
        className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        Inbox
      </span>
      <h1
        className="font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
        style={{ letterSpacing: "-0.3px" }}
      >
        Not here.
      </h1>
      <p className="max-w-[22rem] font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-300)]">
        The inbox wants more room than this screen has. Open it on a laptop for now.
      </p>
      <em className="font-[family-name:var(--font-narrative)] text-[length:var(--text-body)] text-[color:var(--color-brand-pink)]">
        mobile version&rsquo;s still in the back.
      </em>
    </div>
  );
}
