import type { Metadata } from "next";
import { LandingClient } from "./landing-client";

export const metadata: Metadata = {
  title: "Trial Shoot — SuperBad",
  description:
    "Two ways in. Session from $397, Production from $597. Real deliverables, a six-week marketing plan, and 60 days of portal access.",
  openGraph: {
    title: "Trial Shoot — SuperBad",
    description:
      "Two ways in. Session ($397) or Production ($597). Short-form video, edited photos, a bespoke six-week marketing plan. GST inclusive.",
    type: "website",
  },
};

export default function TrialShootPage() {
  return <LandingClient />;
}
