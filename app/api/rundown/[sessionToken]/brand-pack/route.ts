/**
 * GET /api/rundown/[sessionToken]/brand-pack
 *
 * Generates and returns the Brand Pack PDF for a completed Rundown session.
 * Validates the session token, loads profile + enrichment data, calls the
 * LLM generator (with caching), renders to PDF, and streams the result.
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
import { buildBrandPackHtml, brandPackFilename } from "@/lib/brand-dna/brand-pack/template";
import { renderToPdf } from "@/lib/pdf/render";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionToken: string }> },
) {
  try {
    const { sessionToken } = await params;

    // ── Validate session ──
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

    // ── Load profile ──
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

    // ── Load enrichment data from candidate ──
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

    // ── Generate content (cached via brand_pack_json column) ──
    const data = await generateBrandPackContent(profile.id, enrichmentData);

    // ── Render PDF ──
    const html = buildBrandPackHtml(data);
    const pdfBuffer = await renderToPdf(html, {
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    // ── Record download timestamp ──
    await db
      .update(rundownSessions)
      .set({
        pack_downloaded_at_ms: Date.now(),
        updated_at_ms: Date.now(),
      })
      .where(eq(rundownSessions.id, session.id));

    // ── Return PDF ──
    const filename = brandPackFilename(session.business_name);

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[brand-pack] PDF generation failed:", message);
    return NextResponse.json(
      { error: "Failed to generate brand pack", detail: message },
      { status: 500 },
    );
  }
}
