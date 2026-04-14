import type { Metadata } from "next";
import ComingSoon from "./ComingSoon";

export const metadata: Metadata = {
  title: "SuperBad — not yet",
  description: "We're building something. It's not ready. You're early.",
};

export default function Home() {
  return <ComingSoon />;
}
