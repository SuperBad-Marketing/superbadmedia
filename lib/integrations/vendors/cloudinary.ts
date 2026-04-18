import type { VendorManifest } from "@/lib/wizards/types";

export const cloudinaryManifest: VendorManifest = {
  vendorKey: "cloudinary",
  jobs: [
    {
      name: "cloudinary.upload",
      defaultBand: { p95: 3000, p99: 8000 },
      unit: "ms",
    },
    {
      name: "cloudinary.list_folder",
      defaultBand: { p95: 800, p99: 2000 },
      unit: "ms",
    },
    {
      name: "cloudinary.generate_archive",
      defaultBand: { p95: 10000, p99: 25000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "integrations.cloudinary.enabled",
  humanDescription:
    "Cloudinary media API — upload, transform, and deliver trial-shoot galleries.",
};
