import type { Metadata } from "next";
import HomePage from "./HomePage";

export const metadata: Metadata = {
  title: "SuperBad | marketing that people actually feel",
  description:
    "Creative media and performance marketing built around audience behaviour, emotion, and psychology. Not vanity metrics. Melbourne.",
  openGraph: {
    title: "SuperBad | marketing that people actually feel",
    description:
      "Creative media and performance marketing built around audience behaviour, emotion, and psychology. Not vanity metrics. Melbourne.",
    type: "website",
  },
};

export default function Home() {
  return <HomePage />;
}
