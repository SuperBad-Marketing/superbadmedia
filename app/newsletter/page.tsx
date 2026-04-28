import type { Metadata } from "next";
import { NewsletterClient } from "./newsletter-client";

export const metadata: Metadata = {
  title: "Newsletter — SuperBad",
  description:
    "Honest observations about marketing, content, and what actually works. No listicles. No filler. One email when something new drops.",
  openGraph: {
    title: "Newsletter — SuperBad",
    description:
      "Honest observations about marketing, content, and what actually works. No listicles. No filler. One email when something new drops.",
    type: "website",
  },
};

export default function NewsletterPage() {
  return <NewsletterClient />;
}
