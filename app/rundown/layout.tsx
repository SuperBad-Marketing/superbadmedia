import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Brand DNA — SuperBad",
  description:
    "Find out who your brand really is. A deep identity assessment that gives you a complete brand profile, content pillars, typography, colour palette, and a digital presence audit.",
  openGraph: {
    title: "Brand DNA — SuperBad",
    description:
      "An intensive deep dive into your brand, business, and strategy. Walk away with a complete identity profile and a Brand Pack you can actually use.",
    type: "website",
  },
};

export default function RundownLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />
      {children}
    </>
  );
}
