/**
 * Brand DNA Assessment — optional reflection page (section 5 only).
 *
 * Route: /lite/brand-dna/section/5/reflection
 *
 * A free-form text area with a prominent Skip affordance. If submitted,
 * saves the text to brand_dna_profiles.reflection_text. If skipped, passes
 * an empty string so submitReflection can no-op the save.
 *
 * This page guards against being accessed for sections other than 5 by
 * redirecting back to the section page.
 *
 * Owner: BDA-2.
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { submitReflection } from "../../../actions";
import { ReflectionClient } from "./reflection-client";

export const metadata: Metadata = {
  title: "Reflection — Brand DNA — SuperBad",
};

interface ReflectionPageProps {
  params: Promise<{ n: string }>;
  searchParams: Promise<{ profileId?: string }>;
}

export default async function ReflectionPage({
  params,
  searchParams,
}: ReflectionPageProps) {
  const { n } = await params;
  const { profileId } = await searchParams;

  // Only section 5 has a reflection page
  const section = parseInt(n, 10);
  if (isNaN(section) || section !== 5) {
    redirect(`/lite/brand-dna/section/${n}/insight?profileId=${profileId ?? ""}`);
  }

  if (!profileId) {
    redirect("/lite/brand-dna");
  }

  return (
    <ReflectionClient profileId={profileId} submitAction={submitReflection} />
  );
}
