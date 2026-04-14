/**
 * `anthropic` vendor manifest — generic API-key wizard profile (SW-13).
 *
 * Anthropic credentials are a single API key (format `sk-ant-…`). Verify
 * via `GET /v1/models` with `x-api-key: <key>` + `anthropic-version`
 * header — the cheapest authenticated identity check. A `POST /v1/messages`
 * ping would require a valid completion request body; `/v1/models` is a
 * plain list that proves the key works without burning tokens.
 *
 * Note: LLM feature calls continue to route through `lib/ai/models.ts`
 * and the central model registry (memory: `project_llm_model_registry`).
 * This wizard only lands credentials; model selection stays out of scope.
 *
 * Owner: SW-13. Consumer: `lib/wizards/defs/api-key.ts` (vendor profile).
 */
import type { VendorManifest } from "@/lib/wizards/types";

export const anthropicManifest: VendorManifest = {
  vendorKey: "anthropic",
  jobs: [
    {
      name: "anthropic.messages.create",
      defaultBand: { p95: 4000, p99: 15000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Anthropic (Claude) — messages API. Admin pastes API key (sk-ant-…) from console.anthropic.com.",
};

export const ANTHROPIC_API_BASE = "https://api.anthropic.com/v1";
export const ANTHROPIC_VERSION_HEADER = "2023-06-01";
