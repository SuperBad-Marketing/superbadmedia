/**
 * `api-key` — the generic multi-vendor API-key wizard (SW-13, last row of
 * spec §5.1). A single `WizardDefinition` serves four vendors
 * (OpenAI / Anthropic / SerpAPI / Remotion) from one module. Vendor
 * selection lives on the payload (and on the URL as `?vendor=…`); each
 * vendor profile carries its own verify-ping, manifest binding, and copy.
 *
 * First wizard def with N-vendors-from-one-module. Registry stays
 * single-entry (`api-key`); per-vendor `integration_connections` rows
 * land via the vendor profile's manifest, not via the wizard's
 * (undefined) `vendorManifest` field. The completion action selects the
 * manifest at runtime from `payload.vendor`.
 *
 * Rollback: feature-flag-gated via `setup_wizards_enabled`. No schema,
 * no callback route, no settings keys.
 *
 * Owner: SW-13. Consumer: /lite/setup/admin/api-key?vendor=…
 */
import { openaiManifest, OPENAI_API_BASE } from "@/lib/integrations/vendors/openai";
import {
  anthropicManifest,
  ANTHROPIC_API_BASE,
  ANTHROPIC_VERSION_HEADER,
} from "@/lib/integrations/vendors/anthropic";
import { serpapiManifest, SERPAPI_API_BASE } from "@/lib/integrations/vendors/serpapi";
import { remotionManifest } from "@/lib/integrations/vendors/remotion";
import { registerWizard } from "@/lib/wizards/registry";
import type { VendorManifest, WizardDefinition } from "@/lib/wizards/types";

export type ApiKeyVendor = "openai" | "anthropic" | "serpapi" | "remotion";

export type ApiKeyPayload = {
  vendor: ApiKeyVendor;
  apiKey: string;
  verifiedAt: number;
  confirmedAt: number;
};

export type ApiKeyVendorProfile = {
  vendor: ApiKeyVendor;
  label: string;
  manifest: VendorManifest;
  verify: (
    key: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
};

async function pingOpenAI(
  key: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`${OPENAI_API_BASE}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `OpenAI rejected that key: ${res.status} ${body.slice(0, 140) || res.statusText}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error ? `OpenAI ping failed: ${err.message}` : "OpenAI ping failed.",
    };
  }
}

async function pingAnthropic(
  key: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`${ANTHROPIC_API_BASE}/models`, {
      headers: {
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION_HEADER,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `Anthropic rejected that key: ${res.status} ${body.slice(0, 140) || res.statusText}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `Anthropic ping failed: ${err.message}`
          : "Anthropic ping failed.",
    };
  }
}

async function pingSerpApi(
  key: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(
      `${SERPAPI_API_BASE}/account?api_key=${encodeURIComponent(key)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `SerpAPI rejected that key: ${res.status} ${body.slice(0, 140) || res.statusText}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `SerpAPI ping failed: ${err.message}`
          : "SerpAPI ping failed.",
    };
  }
}

/**
 * Remotion has no live verify endpoint — licence keys are local-only.
 * Format-only check: non-empty, minimum plausible length. Documented in
 * the vendor manifest's `humanDescription`.
 */
async function checkRemotion(
  key: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const trimmed = key.trim();
  if (trimmed.length < 20) {
    return {
      ok: false,
      reason: "Remotion licence key looks too short — double-check the paste.",
    };
  }
  return { ok: true };
}

export const API_KEY_VENDOR_PROFILES: Record<ApiKeyVendor, ApiKeyVendorProfile> = {
  openai: {
    vendor: "openai",
    label: "OpenAI",
    manifest: openaiManifest,
    verify: pingOpenAI,
  },
  anthropic: {
    vendor: "anthropic",
    label: "Anthropic",
    manifest: anthropicManifest,
    verify: pingAnthropic,
  },
  serpapi: {
    vendor: "serpapi",
    label: "SerpAPI",
    manifest: serpapiManifest,
    verify: pingSerpApi,
  },
  remotion: {
    vendor: "remotion",
    label: "Remotion",
    manifest: remotionManifest,
    verify: checkRemotion,
  },
};

export function isApiKeyVendor(v: string | undefined | null): v is ApiKeyVendor {
  return v === "openai" || v === "anthropic" || v === "serpapi" || v === "remotion";
}

export function getApiKeyVendorProfile(
  vendor: ApiKeyVendor,
): ApiKeyVendorProfile {
  return API_KEY_VENDOR_PROFILES[vendor];
}

export const apiKeyWizard: WizardDefinition<ApiKeyPayload> = {
  key: "api-key",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "paste-key",
      type: "api-key-paste",
      label: "Paste key",
      resumable: true,
      config: { label: "API key" },
    },
    {
      key: "review",
      type: "review-and-confirm",
      label: "Review",
      resumable: true,
      config: { ctaLabel: "Looks right — finish" },
    },
    {
      key: "celebrate",
      type: "celebration",
      label: "Done",
      resumable: false,
    },
  ],
  completionContract: {
    required: ["vendor", "apiKey", "verifiedAt", "confirmedAt"],
    verify: async (p) => {
      if (!isApiKeyVendor(p.vendor)) {
        return { ok: false, reason: `Unknown vendor: ${String(p.vendor)}` };
      }
      return API_KEY_VENDOR_PROFILES[p.vendor].verify(p.apiKey);
    },
    artefacts: { integrationConnections: true },
  },
  // vendorManifest intentionally undefined — the generic wizard serves
  // four vendors; the completion action selects the right manifest from
  // `payload.vendor` at runtime. registerIntegration is called with the
  // per-vendor manifest, not the def's.
  vendorManifest: undefined,
  voiceTreatment: {
    introCopy:
      "Paste the key, we'll ping the vendor, then you're good — this one's four-in-one.",
    outroCopy: "Key's on file. That vendor's plugged in.",
    tabTitlePool: {
      setup: ["Setup — API key"],
      connecting: ["Testing key…"],
      confirming: ["Confirming key…"],
      connected: ["Key saved."],
      stuck: ["API key — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(apiKeyWizard);
