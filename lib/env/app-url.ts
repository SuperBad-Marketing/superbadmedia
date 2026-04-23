const DEV_FALLBACK = "http://localhost:3001";

export function getAppUrl(): string {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (value) return value.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not set. All outbound links will break. " +
        "Set it in your hosting environment variables.",
    );
  }

  return DEV_FALLBACK;
}
