"use client";

/**
 * SceneShell — pathname-aware ambient frame for /lite/brand-dna/**.
 *
 * Persists across route navigations (mounted in the BDA layout) so the
 * blob ambient scene cross-fades rather than re-mounting. Derives the
 * current scene + section + label from the pathname.
 */

import * as React from "react";
import { usePathname } from "next/navigation";

import { SECTION_TITLES } from "@/lib/brand-dna/question-bank";

import { AmbientScene, type BrandDnaScene } from "./ambient-scene";
import { ProgressChrome } from "./progress-chrome";

interface SceneShellProps {
  children: React.ReactNode;
}

export function SceneShell({ children }: SceneShellProps) {
  const pathname = usePathname() ?? "";
  const { scene, currentSection, sectionLabel } = derive(pathname);

  return (
    <>
      <AmbientScene scene={scene} />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ProgressChrome currentSection={currentSection} sectionLabel={sectionLabel} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>
      </div>
    </>
  );
}

function derive(pathname: string): {
  scene: BrandDnaScene;
  currentSection: 0 | 1 | 2 | 3 | 4 | 5 | "reveal";
  sectionLabel?: string;
} {
  if (pathname.endsWith("/lite/brand-dna") || pathname.endsWith("/lite/brand-dna/")) {
    return { scene: 1, currentSection: 0 };
  }
  if (pathname.includes("/lite/brand-dna/reveal")) {
    return { scene: 3, currentSection: "reveal" };
  }
  const m = pathname.match(/\/lite\/brand-dna\/section\/(\d)(\/(insight|reflection))?/);
  if (m) {
    const n = Math.max(1, Math.min(5, Number(m[1]))) as 1 | 2 | 3 | 4 | 5;
    const between = Boolean(m[3]);
    return {
      scene: between ? 2 : 1,
      currentSection: n,
      sectionLabel: SECTION_TITLES[n]?.toLowerCase(),
    };
  }
  return { scene: 1, currentSection: 0 };
}
