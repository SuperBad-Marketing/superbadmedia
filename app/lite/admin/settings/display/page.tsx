import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/user";
import {
  DEFAULT_MOTION_PREFERENCE,
  DEFAULT_SOUNDS_ENABLED,
  DEFAULT_DENSITY_PREFERENCE,
  DEFAULT_TEXT_SIZE_PREFERENCE,
  DEFAULT_THEME_PRESET,
  DEFAULT_TYPEFACE_PRESET,
  type MotionPreference,
  type DensityPreference,
  type TextSizePreference,
  type ThemePreset,
  type TypefacePreset,
} from "@/lib/design-tokens";
import { DisplaySettings } from "./display-settings";

export const metadata: Metadata = {
  title: "SuperBad — Display",
  robots: { index: false, follow: false },
};

export default async function DisplaySettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const row = db
    .select({
      motion_preference: user.motion_preference,
      sounds_enabled: user.sounds_enabled,
      density_preference: user.density_preference,
      text_size_preference: user.text_size_preference,
      theme_preset: user.theme_preset,
      typeface_preset: user.typeface_preset,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .get();

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
          <span className="text-[color:var(--color-brand-pink)]">Display</span>
        </div>
        <div className="mt-3">
          <h1
            className="font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.3px" }}
          >
            Display
          </h1>
        </div>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          How the platform looks and feels. Changes take effect immediately.
        </p>
      </header>
      <div className="px-4">
        <DisplaySettings
          motion={(row?.motion_preference as MotionPreference) ?? DEFAULT_MOTION_PREFERENCE}
          sounds={row?.sounds_enabled ?? DEFAULT_SOUNDS_ENABLED}
          density={(row?.density_preference as DensityPreference) ?? DEFAULT_DENSITY_PREFERENCE}
          textSize={(row?.text_size_preference as TextSizePreference) ?? DEFAULT_TEXT_SIZE_PREFERENCE}
          theme={(row?.theme_preset as ThemePreset) ?? DEFAULT_THEME_PRESET}
          typeface={(row?.typeface_preset as TypefacePreset) ?? DEFAULT_TYPEFACE_PRESET}
        />
      </div>
    </div>
  );
}
