"use server";

import { z } from "zod";
import { processApplication, type ApplyFormInput } from "@/lib/hiring/apply";

const applySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().email().max(200),
  roleBriefId: z.string().nullable(),
  portfolioUrls: z
    .array(z.string().url().max(2000))
    .min(1)
    .max(3),
  locationCity: z.string().trim().min(1).max(200),
  rateExpectationBand: z.string().min(1),
  availabilityHoursPerWeek: z.number().int().min(1).max(80),
  availableFromMs: z.number().nullable(),
  recommendSomeone: z.string().max(2000).nullable(),
});

export type ApplyInput = z.infer<typeof applySchema>;

export type ApplyResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function submitApplyFormAction(
  raw: ApplyInput,
): Promise<ApplyResult> {
  const parsed = applySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "Please check your form and try again." };
  }

  const input: ApplyFormInput = {
    name: parsed.data.name,
    email: parsed.data.email,
    roleBriefId: parsed.data.roleBriefId,
    portfolioUrls: parsed.data.portfolioUrls,
    locationCity: parsed.data.locationCity,
    rateExpectationBand: parsed.data.rateExpectationBand,
    availabilityHoursPerWeek: parsed.data.availabilityHoursPerWeek,
    availableFromMs: parsed.data.availableFromMs,
    recommendSomeone: parsed.data.recommendSomeone,
  };

  const result = await processApplication(input);

  if (!result.ok) {
    return { ok: false, reason: result.reason ?? "Something went wrong." };
  }

  return { ok: true };
}
