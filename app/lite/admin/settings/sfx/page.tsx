import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { getSfxLibraryAction } from "./actions";
import { SfxLibraryAdmin } from "./sfx-library-admin";

export const metadata: Metadata = {
  title: "SuperBad — SFX Library",
  robots: { index: false, follow: false },
};

export default async function SfxSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { sounds } = await getSfxLibraryAction();

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Settings{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          <span className="text-[color:var(--color-brand-pink)]">
            SFX Library
          </span>
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.3px" }}
        >
          Sound Effects
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Sounds available in the Content Studio motion timeline.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            upload your own, or use what&apos;s here.
          </em>
        </p>
      </header>

      <div className="px-4 pb-8">
        <SfxLibraryAdmin initialSounds={sounds} />
      </div>
    </div>
  );
}
