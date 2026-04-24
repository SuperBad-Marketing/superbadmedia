import { z } from "zod";

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
