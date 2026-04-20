import { brand, neutral } from "@/lib/design-tokens";

export const metadata = {
  title: "SuperBad — Link expired",
};

export default function BenchExpiredPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-surface-0)] p-6">
      <div className="max-w-sm text-center">
        <h1
          className="mb-3 text-2xl font-semibold tracking-tight"
          style={{ color: neutral[900] }}
        >
          Link expired
        </h1>
        <p
          className="text-base leading-relaxed"
          style={{ color: neutral[500] }}
        >
          This link has already been used or has expired. Check your
          inbox for a newer one, or reach out to{" "}
          <a
            href="mailto:andy@superbadmedia.com.au"
            className="underline underline-offset-2"
            style={{ color: brand.orange }}
          >
            andy@superbadmedia.com.au
          </a>
          .
        </p>
      </div>
    </div>
  );
}
