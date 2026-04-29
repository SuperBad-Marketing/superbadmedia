const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  token: string,
  remoteIp?: string,
): Promise<{ success: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) {
    return { success: true };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
    ...(remoteIp ? { remoteip: remoteIp } : {}),
  });

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    return { success: false, error: `Turnstile API error: ${res.status}` };
  }

  const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
  if (!data.success) {
    return {
      success: false,
      error: `Turnstile validation failed: ${(data["error-codes"] ?? []).join(", ")}`,
    };
  }

  return { success: true };
}
