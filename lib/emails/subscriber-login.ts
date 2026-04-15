/**
 * SB-6a: subscriber magic-link login email. Reuses the branded paragraph
 * + CTA shell from `lib/invoicing/email-html.ts` so the post-payment
 * moment lands with the same visual weight as the invoice that sits next
 * to it in the inbox.
 *
 * No Claude drafting — deterministic copy. The link is the whole email.
 */
import { sendEmail } from "@/lib/channels/email";
import { paragraphsToInvoiceHtml } from "@/lib/invoicing/email-html";

export type SubscriberLoginEmailInput = {
  to: string;
  magicLinkUrl: string;
  productName: string;
  tierName: string;
  /** "initial" = post-first-payment issue; "resend" = welcome-page button. */
  context: "initial" | "resend";
};

function buildCopy(input: SubscriberLoginEmailInput): {
  subject: string;
  paragraphs: string[];
} {
  if (input.context === "initial") {
    return {
      subject: `Your SuperBad login — ${input.productName}`,
      paragraphs: [
        `Payment landed. You're on the ${input.tierName} tier of ${input.productName}.`,
        `Tap the button below to open your dashboard. The link's good for 24 hours and works once — ask for another if it expires.`,
      ],
    };
  }
  return {
    subject: `Your SuperBad login link`,
    paragraphs: [
      `Here's a fresh login link for your SuperBad dashboard.`,
      `Good for 24 hours, single use. If you didn't request this, you can ignore the email.`,
    ],
  };
}

export async function sendSubscriberLoginEmail(
  input: SubscriberLoginEmailInput,
) {
  const { subject, paragraphs } = buildCopy(input);
  const html = paragraphsToInvoiceHtml(paragraphs, input.magicLinkUrl, "Log in →");
  return sendEmail({
    to: input.to,
    subject,
    body: html,
    classification: "subscriber_login_link",
    purpose: `subscriber_login_link:${input.context}`,
  });
}
