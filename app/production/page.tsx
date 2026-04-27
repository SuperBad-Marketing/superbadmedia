import type { Metadata } from "next";
import { ProductionClient } from "./production-client";

export const metadata: Metadata = {
  title: "Production — SuperBad",
  description:
    "Cinematic, entertainment-first content that builds you a media channel, an engaged audience, and a self-funding acquisition engine.",
  openGraph: {
    title: "Production — SuperBad",
    description:
      "Cinematic, entertainment-first content that builds you a media channel, an engaged audience, and a self-funding acquisition engine.",
    type: "website",
  },
};

export default function ProductionPage() {
  return <ProductionClient />;
}
