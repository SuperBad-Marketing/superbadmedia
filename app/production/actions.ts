"use server";

import { Resend } from "resend";
import { cancelPendingSequenceByEmail } from "@/lib/rundown/sequence-cancel";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function submitProductionInquiry(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;

  if (!name || !email) {
    return { error: "Name and email are required." };
  }

  try {
    await resend.emails.send({
      from: "SuperBad <noreply@superbadmedia.com.au>",
      to: "andy@superbadmedia.com.au",
      subject: `Production inquiry — ${name}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : null,
        "",
        "Submitted from the production page.",
      ]
        .filter(Boolean)
        .join("\n"),
    });
    cancelPendingSequenceByEmail(email, "production_inquiry").catch(() => {});

    return { success: true };
  } catch {
    return { error: "Something went wrong. Try emailing directly." };
  }
}
