import type { Metadata } from "next";
import { AssessmentIntroClient } from "@/components/lite/brand-dna/assessment-intro-client";

export const metadata: Metadata = { title: "Brand DNA — SuperBad" };

export default function BrandDnaIntroPage() {
  return (
    <AssessmentIntroClient continueHref="/lite/brand-dna/section/1" />
  );
}
