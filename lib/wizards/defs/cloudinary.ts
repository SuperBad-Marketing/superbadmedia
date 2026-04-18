import { z } from "zod";
import { cloudinaryManifest } from "@/lib/integrations/vendors/cloudinary";
import { testConnection } from "@/lib/cloudinary";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

export type CloudinaryPayload = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  verifiedAt: number;
  confirmedAt: number;
};

export const cloudinaryCredentialsSchema = z.object({
  cloudName: z
    .string()
    .trim()
    .min(1, "Cloud name is required.")
    .regex(
      /^[a-z0-9][a-z0-9_-]*$/i,
      "That doesn't look like a Cloudinary cloud name.",
    ),
  apiKey: z
    .string()
    .trim()
    .min(1, "API key is required.")
    .regex(/^\d+$/, "Cloudinary API keys are numeric."),
  apiSecret: z
    .string()
    .trim()
    .min(1, "API secret is required."),
});

export const cloudinaryWizard: WizardDefinition<CloudinaryPayload> = {
  key: "cloudinary",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "credentials",
      type: "form",
      label: "Credentials",
      resumable: true,
      config: { schema: cloudinaryCredentialsSchema },
    },
    {
      key: "review",
      type: "review-and-confirm",
      label: "Review",
      resumable: true,
      config: { ctaLabel: "Connect Cloudinary" },
    },
    {
      key: "celebrate",
      type: "celebration",
      label: "Done",
      resumable: false,
    },
  ],
  completionContract: {
    required: ["cloudName", "apiKey", "apiSecret", "verifiedAt", "confirmedAt"],
    verify: async (p) => testConnection(p.cloudName, p.apiKey, p.apiSecret),
    artefacts: { integrationConnections: true },
  },
  vendorManifest: cloudinaryManifest,
  voiceTreatment: {
    introCopy:
      "Cloudinary handles your gallery photos. Paste the credentials from your Cloudinary dashboard and we'll make sure they work.",
    outroCopy:
      "Cloudinary's wired in. Gallery uploads will land where they should.",
    tabTitlePool: {
      setup: ["Setup — Cloudinary"],
      connecting: ["Connecting Cloudinary…"],
      confirming: ["Confirming Cloudinary…"],
      connected: ["Cloudinary connected."],
      stuck: ["Cloudinary — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(cloudinaryWizard);
