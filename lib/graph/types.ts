import { z } from "zod";

export const GraphTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
  token_type: z.string(),
  scope: z.string().optional(),
});
export type GraphTokenResponse = z.infer<typeof GraphTokenResponseSchema>;

export const GraphEmailAddressSchema = z.object({
  name: z.string().optional().default(""),
  address: z.string(),
});

export const GraphMessageSchema = z.object({
  id: z.string(),
  internetMessageId: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  bodyPreview: z.string().optional(),
  body: z.object({
    contentType: z.string(),
    content: z.string(),
  }),
  from: z.object({ emailAddress: GraphEmailAddressSchema }).nullable().optional(),
  toRecipients: z.array(z.object({ emailAddress: GraphEmailAddressSchema })).default([]),
  ccRecipients: z.array(z.object({ emailAddress: GraphEmailAddressSchema })).default([]),
  bccRecipients: z.array(z.object({ emailAddress: GraphEmailAddressSchema })).default([]),
  sentDateTime: z.string().nullable().optional(),
  receivedDateTime: z.string().nullable().optional(),
  internetMessageHeaders: z
    .array(z.object({ name: z.string(), value: z.string() }))
    .optional()
    .default([]),
  hasAttachments: z.boolean().default(false),
  isRead: z.boolean().default(false),
  isDraft: z.boolean().default(false),
  conversationId: z.string().optional(),
});
export type GraphMessage = z.infer<typeof GraphMessageSchema>;

export const GraphDeltaResponseSchema = z.object({
  value: z.array(GraphMessageSchema).default([]),
  "@odata.nextLink": z.string().optional(),
  "@odata.deltaLink": z.string().optional(),
});
export type GraphDeltaResponse = z.infer<typeof GraphDeltaResponseSchema>;

export const GraphSubscriptionSchema = z.object({
  id: z.string(),
  expirationDateTime: z.string(),
  resource: z.string(),
  changeType: z.string(),
});
export type GraphSubscription = z.infer<typeof GraphSubscriptionSchema>;

export const GraphWebhookNotificationSchema = z.object({
  value: z.array(
    z.object({
      subscriptionId: z.string(),
      changeType: z.string(),
      resource: z.string(),
      clientState: z.string().optional(),
      resourceData: z
        .object({
          "@odata.type": z.string().optional(),
          "@odata.id": z.string().optional(),
          id: z.string().optional(),
        })
        .optional(),
    }),
  ),
});
export type GraphWebhookNotification = z.infer<typeof GraphWebhookNotificationSchema>;

export type GraphCredentials = {
  accessToken: string;
  refreshToken: string;
  expiresAtMs: number;
};
