import { getCredential } from "@/lib/integrations/getCredential";

export type TwilioCredentials = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

export async function getTwilioCredentials(): Promise<TwilioCredentials | null> {
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!fromNumber) return null;

  const raw = await getCredential("twilio");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { accountSid?: string; authToken?: string };
    if (!parsed.accountSid || !parsed.authToken) return null;
    return { accountSid: parsed.accountSid, authToken: parsed.authToken, fromNumber };
  } catch {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = raw;
    if (!accountSid || !authToken) return null;
    return { accountSid, authToken, fromNumber };
  }
}
