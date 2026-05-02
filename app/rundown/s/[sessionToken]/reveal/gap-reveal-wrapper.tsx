"use client";

import * as React from "react";
import { GapReveal } from "@/components/lite/brand-dna/gap-reveal";
import type { GapRevealData } from "@/lib/brand-dna/generate-gap-reveal";
import type { DomainPresenceScore } from "@/lib/brand-dna/build-presence-scores";
import type { MarketingPlaybook } from "@/lib/brand-dna/generate-marketing-playbook";

interface Props {
  sessionToken: string;
  businessName: string;
  gapReveal: GapRevealData | null;
  presenceScores: DomainPresenceScore[];
  trialShootUrl: string;
  marketingPlaybook?: MarketingPlaybook | null;
}

export function GapRevealWrapper({
  sessionToken,
  businessName,
  gapReveal,
  presenceScores,
  trialShootUrl,
  marketingPlaybook,
}: Props) {
  const [packBlobUrl, setPackBlobUrl] = React.useState<string | null>(null);
  const [packLoading, setPackLoading] = React.useState(false);
  const [packError, setPackError] = React.useState(false);
  const packFetchRef = React.useRef<Promise<string | null> | null>(null);

  React.useEffect(() => {
    const url = `/api/rundown/${sessionToken}/brand-pack`;
    const promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        setPackBlobUrl(blobUrl);
        return blobUrl;
      })
      .catch(() => {
        setPackError(true);
        return null;
      });
    packFetchRef.current = promise;
    return () => {
      promise.then((blobUrl) => {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      });
    };
  }, [sessionToken]);

  async function handleViewBrandPack() {
    if (packBlobUrl) {
      window.open(packBlobUrl, "_blank");
      return;
    }
    if (packError) {
      window.open(`/api/rundown/${sessionToken}/brand-pack`, "_blank");
      return;
    }
    setPackLoading(true);
    const blobUrl = await packFetchRef.current;
    setPackLoading(false);
    if (blobUrl) {
      window.open(blobUrl, "_blank");
    } else {
      window.open(`/api/rundown/${sessionToken}/brand-pack`, "_blank");
    }
  }

  return (
    <GapReveal
      sessionToken={sessionToken}
      businessName={businessName}
      gapReveal={gapReveal}
      presenceScores={presenceScores}
      trialShootUrl={trialShootUrl}
      onViewBrandPack={() => void handleViewBrandPack()}
      packLoading={packLoading}
      marketingPlaybook={marketingPlaybook}
    />
  );
}
