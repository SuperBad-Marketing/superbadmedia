import type { Metadata } from "next";
import { LandingClient } from "./landing-client";

export const metadata: Metadata = {
  title: "Trial Shoot — SuperBad",
  description:
    "1 short-form video. 10 edited photographs. A bespoke 6-week marketing plan. 60 days of portal access.",
  openGraph: {
    title: "Trial Shoot — SuperBad",
    description:
      "1 short-form video. 10 edited photographs. A bespoke 6-week marketing plan. $297 GST inclusive.",
    type: "website",
  },
};

export default function TrialShootPage() {
  return <LandingClient />;
}
