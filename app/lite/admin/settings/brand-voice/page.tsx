import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { and, eq, asc } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { brand_voice_examples } from "@/lib/db/schema/brand-voice-examples";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { BrandVoiceAdmin } from "./brand-voice-admin";

export const metadata: Metadata = {
  title: "SuperBad — Brand Voice",
  robots: { index: false, follow: false },
};

async function getBrandDnaStatus(): Promise<
  "complete" | "in_progress" | "not_started"
> {
  const row = await db
    .select({ status: brand_dna_profiles.status })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.subject_type, "superbad_self"),
        eq(brand_dna_profiles.is_current, true),
      ),
    )
    .get();

  if (!row) return "not_started";
  if (row.status === "complete") return "complete";
  return "in_progress";
}

export default async function BrandVoiceSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const [examples, brandDnaStatus] = await Promise.all([
    db
      .select()
      .from(brand_voice_examples)
      .orderBy(
        asc(brand_voice_examples.surface),
        asc(brand_voice_examples.sort_order),
      ),
    getBrandDnaStatus(),
  ]);

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          Settings{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          <span className="text-[color:var(--color-brand-pink)]">
            Brand Voice
          </span>
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.3px" }}
        >
          Brand Voice
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          How SuperBad sounds across every AI-generated surface.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            the voice behind the machine.
          </em>
        </p>
      </header>
      <BrandVoiceAdmin
        initialExamples={examples}
        brandDnaStatus={brandDnaStatus}
      />
    </div>
  );
}
