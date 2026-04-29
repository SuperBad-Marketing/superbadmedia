/**
 * GET /api/rundown/[sessionToken]/brand-pack
 *
 * Generates and returns the Brand Pack as a viewable HTML page.
 * The page includes a "Download as PDF" button that triggers window.print().
 *
 * Validates the session token, loads profile + enrichment data, calls the
 * LLM generator (with caching), and returns the styled HTML.
 *
 * Updates `rundown_sessions.pack_downloaded_at_ms` on success.
 *
 * Owner: BDA-PACK / Rundown.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import type { ViabilityProfile } from "@/lib/lead-gen/types";
import { generateBrandPackContent } from "@/lib/brand-dna/brand-pack/generate";
import { buildBrandPackHtml } from "@/lib/brand-dna/brand-pack/template";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionToken: string }> },
) {
  try {
    const { sessionToken } = await params;

    const sessions = await db
      .select()
      .from(rundownSessions)
      .where(eq(rundownSessions.session_token, sessionToken))
      .limit(1);

    const session = sessions[0];
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (!session.profile_id) {
      return NextResponse.json(
        { error: "Assessment not yet complete" },
        { status: 400 },
      );
    }

    const profiles = await db
      .select()
      .from(brand_dna_profiles)
      .where(eq(brand_dna_profiles.id, session.profile_id))
      .limit(1);

    const profile = profiles[0];
    if (!profile || profile.status !== "complete") {
      return NextResponse.json(
        { error: "Profile not ready" },
        { status: 400 },
      );
    }

    let enrichmentData: ViabilityProfile | null = null;

    if (session.candidate_id) {
      const candidateRows = await db
        .select({ viability_profile_json: leadCandidates.viability_profile_json })
        .from(leadCandidates)
        .where(eq(leadCandidates.id, session.candidate_id))
        .limit(1);

      if (candidateRows[0]?.viability_profile_json) {
        enrichmentData = candidateRows[0].viability_profile_json as ViabilityProfile;
      }
    }

    const data = await generateBrandPackContent(profile.id, enrichmentData);
    const html = buildBrandPackHtml(data);

    await db
      .update(rundownSessions)
      .set({
        pack_downloaded_at_ms: Date.now(),
        updated_at_ms: Date.now(),
      })
      .where(eq(rundownSessions.id, session.id));

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[brand-pack] Generation failed:", message);
    return NextResponse.json(
      { error: "Failed to generate brand pack", detail: message },
      { status: 500 },
    );
  }
}
