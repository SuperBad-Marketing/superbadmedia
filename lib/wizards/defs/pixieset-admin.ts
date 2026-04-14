/**
 * `pixieset-admin` — first non-critical admin integration wizard (SW-9).
 *
 * Pattern copied from `resend` (api-key-paste → review → celebration) but
 * step 1 swaps to a `form` step capturing a gallery URL rather than an API
 * key. Per P0 spike outcome B, Pixieset has no public API — the wizard
 * captures the admin's per-client gallery URL as the canonical link and
 * there's nothing to ping.
 *
 * `completionContract.verify` returns `{ ok: true }` unconditionally —
 * there's no remote to test. The `integrationConnections` artefact gate
 * still fires via `registerIntegration()` in the celebration orchestrator
 * so the `integration_connections` row is the source of truth that the
 * admin has declared Pixieset connected.
 *
 * `capstone` is undefined — Pixieset is non-critical, not part of the
 * first-run flight capstone arc.
 *
 * Owner: SW-9. Consumer: /lite/setup/admin/[key].
 */
import { z } from "zod";
import { pixiesetManifest } from "@/lib/integrations/vendors/pixieset";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type PixiesetAdminPayload = {
  galleryUrl: string;
  slug: string;
  confirmedAt: number;
};

/**
 * Exported so the per-wizard client can reuse the same validation shape in
 * its form-step config. `<slug>.pixieset.com` is the canonical URL pattern
 * — rejects both unrelated hosts and bare pixieset.com URLs.
 */
export const pixiesetGalleryUrlSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Paste the gallery URL.")
    .refine(
      (v) => {
        try {
          const u = new URL(v);
          if (u.protocol !== "https:") return false;
          return /^[a-z0-9-]+\.pixieset\.com$/i.test(u.hostname);
        } catch {
          return false;
        }
      },
      {
        message:
          "That doesn't look like a Pixieset URL (expected https://<slug>.pixieset.com/…).",
      },
    ),
});

export function extractPixiesetSlug(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const dot = host.indexOf(".pixieset.com");
    return dot > 0 ? host.slice(0, dot) : host;
  } catch {
    return "";
  }
}

export const pixiesetAdminWizard: WizardDefinition<PixiesetAdminPayload> = {
  key: "pixieset-admin",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "paste-url",
      type: "form",
      label: "Paste gallery URL",
      resumable: true,
      config: { schema: pixiesetGalleryUrlSchema },
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
    required: ["galleryUrl", "slug", "confirmedAt"],
    verify: async () => ({ ok: true }),
    artefacts: { integrationConnections: true },
  },
  vendorManifest: pixiesetManifest,
  voiceTreatment: {
    introCopy:
      "Pixieset's a link-out — no API to wire up. Paste a gallery URL so we know where to send clients.",
    outroCopy: "Pixieset's on file. Client galleries will link out cleanly.",
    tabTitlePool: {
      setup: ["Setup — Pixieset"],
      connecting: ["Saving Pixieset…"],
      confirming: ["Confirming Pixieset…"],
      connected: ["Pixieset saved."],
      stuck: ["Pixieset — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(pixiesetAdminWizard);
