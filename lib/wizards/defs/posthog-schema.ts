import { z } from "zod";

export type PosthogPayload = {
  apiKey: string;
  posthogHost: string;
  verifiedAt: number;
  confirmedAt: number;
};

export const posthogCredentialsSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(1, "Project API key is required.")
    .regex(/^phc_/, "PostHog project API keys start with phc_."),
  posthogHost: z
    .string()
    .trim()
    .url("Must be a valid URL.")
    .optional()
    .or(z.literal("")),
});
