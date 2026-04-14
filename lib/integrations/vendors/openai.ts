/**
 * `openai` vendor manifest — generic API-key wizard profile (SW-13).
 *
 * OpenAI credentials are a single API key (format `sk-…`). Verify via
 * `GET /v1/models` with `Authorization: Bearer <key>` — the cheapest
 * authenticated identity check.
 *
 * Owner: SW-13. Consumer: `lib/wizards/defs/api-key.ts` (vendor profile).
 */
import type { VendorManifest } from "@/lib/wizards/types";

export const openaiManifest: VendorManifest = {
  vendorKey: "openai",
  jobs: [
    {
      name: "openai.chat.completion",
      defaultBand: { p95: 4000, p99: 12000 },
      unit: "ms",
    },
    {
      name: "openai.image.generate",
      defaultBand: { p95: 6000, p99: 18000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "OpenAI — chat + image generation. Admin pastes API key (sk-…) from platform.openai.com.",
};

/**
 * OpenAI REST base. Design-time constant; not an autonomy threshold.
 * The verify identity-ping hits `${OPENAI_API_BASE}/models`.
 */
export const OPENAI_API_BASE = "https://api.openai.com/v1";
