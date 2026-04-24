import { cloudinaryManifest } from "@/lib/integrations/vendors/cloudinary";
import { testConnection } from "@/lib/cloudinary";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";
export { type CloudinaryPayload, cloudinaryCredentialsSchema } from "./cloudinary-schema";
import { cloudinaryCredentialsSchema } from "./cloudinary-schema";
import type { CloudinaryPayload } from "./cloudinary-schema";

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
