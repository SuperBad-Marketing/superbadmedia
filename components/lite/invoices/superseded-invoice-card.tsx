import Link from "next/link";

/**
 * Void invoice surface. If there's a replacement invoice, gently point
 * the client at it. Otherwise a quiet "This invoice is no longer
 * valid" card — the admin voided without superseding.
 *
 * Mirrors Quote Builder's superseded-URL treatment (spec §4.4).
 */
export function SupersededInvoiceCard(props: {
  invoiceNumber: string;
  replacementToken: string | null;
}) {
  const hasReplacement = !!props.replacementToken;
  return (
    <main
      className="min-h-[100dvh] flex items-center justify-center px-6"
      style={{
        backgroundColor: "var(--brand-cream, #faf6ef)",
        color: "var(--brand-charcoal, #1a1a1a)",
        fontFamily: "var(--font-dm-sans, system-ui)",
      }}
    >
      <div
        className="w-full max-w-[480px] rounded-lg p-10 text-center"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--brand-charcoal) 4%, transparent)",
        }}
        data-testid="invoice-void-card"
      >
        <div className="text-[10px] uppercase tracking-[0.24em] text-[#8a8a8a]">
          {props.invoiceNumber}
        </div>
        <h1
          className="mt-3 text-3xl"
          style={{ fontFamily: "var(--font-display, Impact)" }}
        >
          {hasReplacement
            ? "This invoice has been updated."
            : "This invoice is no longer valid."}
        </h1>
        {hasReplacement ? (
          <>
            <p
              className="mt-4 italic"
              style={{ fontFamily: "var(--font-narrative, serif)" }}
            >
              Andy&apos;s sent a fresh one.
            </p>
            <Link
              href={`/lite/invoices/${props.replacementToken}`}
              className="mt-8 inline-flex items-center gap-2 rounded-md px-5 py-3 text-white"
              style={{ backgroundColor: "var(--brand-red, #c1202d)" }}
              data-testid="invoice-void-replacement-link"
            >
              <span style={{ fontFamily: "var(--font-display, Impact)" }}>
                View the current version
              </span>
              <span aria-hidden>→</span>
            </Link>
          </>
        ) : (
          <p className="mt-4 text-sm text-[#6b6b6b]">
            Reach Andy at hi@superbadmedia.com.au if this looks wrong.
          </p>
        )}
      </div>
    </main>
  );
}
