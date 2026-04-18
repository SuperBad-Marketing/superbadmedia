import { redirect, notFound } from "next/navigation";

import { getPortalSession } from "@/lib/portal/guard";

import { ReflectionClient } from "@/app/lite/brand-dna/section/[n]/reflection/reflection-client";
import { submitPortalReflection } from "../../../actions";

/**
 * Portal Brand DNA — optional reflection page (section 5 only).
 *
 * Reuses admin ReflectionClient with portal-side submit action.
 *
 * Owner: BDA-5.
 */
export default async function PortalBrandDnaReflectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ n: string }>;
  searchParams: Promise<{ profileId?: string }>;
}) {
  const session = await getPortalSession();
  if (!session) {
    redirect("/lite/portal/recover");
  }

  const { n } = await params;
  const section = parseInt(n, 10);
  if (section !== 5) {
    notFound();
  }

  const { profileId } = await searchParams;
  if (!profileId) {
    redirect("/lite/portal/brand-dna");
  }

  return (
    <ReflectionClient
      profileId={profileId}
      submitAction={submitPortalReflection}
    />
  );
}
