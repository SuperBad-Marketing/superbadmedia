export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { auditSubmissions } from "@/lib/db/schema/audit-submissions";
import { hashIp, checkRateLimit, recordSubmission, checkDailyCap } from "@/lib/audit/rate-limit";
import { verifyTurnstile } from "@/lib/audit/turnstile";
import { runAuditEnrichment, type SignalName } from "@/lib/audit/enrichment";
import {
  scoreAuditCategory,
  scoreAuditOverall,
  AUDIT_CATEGORIES,
  type CategoryScore,
} from "@/lib/audit/scoring";
import { generateCategoryExplanations } from "@/lib/audit/explanations";
import { createAuditDeal } from "@/lib/audit/pipeline";
import { generateAuditFollowUp } from "@/lib/audit/followup";
import { deliverAuditReport } from "@/lib/audit/deliver-report";

const submitSchema = z.object({
  businessName: z.string().min(1).max(200),
  websiteUrl: z.string().url().max(500),
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  instagramHandle: z.string().max(100).optional().nullable(),
  facebookPageUrl: z.string().max(500).optional().nullable(),
  youtubeChannel: z.string().max(200).optional().nullable(),
  googleMapsUrl: z.string().max(500).optional().nullable(),
  turnstileToken: z.string().min(1),
  honeypot: z.string().optional(),
});

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`)
      .hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = submitSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Invalid form data", details: parsed.error.flatten() }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const data = parsed.data;

  if (data.honeypot) {
    return new Response(JSON.stringify({ error: "Submission rejected" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  const ipHash = hashIp(ip);

  const rateCheck = await checkRateLimit(ipHash);
  if (!rateCheck.allowed) {
    return new Response(JSON.stringify({ error: rateCheck.reason }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const capCheck = await checkDailyCap();
  if (!capCheck.allowed) {
    return new Response(JSON.stringify({ error: capCheck.reason }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const turnstile = await verifyTurnstile(data.turnstileToken, ip);
  if (!turnstile.success) {
    return new Response(
      JSON.stringify({ error: "Verification failed. Please try again." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const domain = extractDomain(data.websiteUrl);
  const submissionId = crypto.randomUUID();

  await recordSubmission(ipHash);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, payload: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
        );
      }

      sendEvent("started", { submissionId });

      // Run enrichment with progress callbacks
      const enrichment = await runAuditEnrichment(
        {
          businessName: data.businessName,
          domain,
          websiteUrl: data.websiteUrl,
          email: data.email,
          instagramHandle: data.instagramHandle,
          facebookPageUrl: data.facebookPageUrl,
          youtubeChannel: data.youtubeChannel,
          googleMapsUrl: data.googleMapsUrl,
        },
        submissionId,
        (signal: SignalName, status: "complete" | "failed") => {
          sendEvent("signal", { signal, status });
        },
      );

      sendEvent("enrichment_complete", {
        signals_succeeded: enrichment.signals_succeeded,
        signals_attempted: enrichment.signals_attempted,
        duration_ms: enrichment.duration_ms,
      });

      // Score
      const categoryScores: CategoryScore[] = AUDIT_CATEGORIES.map((cat) =>
        scoreAuditCategory(cat, enrichment.profile),
      );
      const overall = scoreAuditOverall(categoryScores);

      sendEvent("scored", { overall, categories: categoryScores });

      // Generate explanations
      const explanations = await generateCategoryExplanations(
        categoryScores,
        enrichment.profile,
        data.businessName,
      );

      const availableCount = categoryScores.filter((c) => c.available).length;
      const retryPending = availableCount < 3;

      // Insert submission
      await db.insert(auditSubmissions).values({
        id: submissionId,
        business_name: data.businessName,
        website_url: data.websiteUrl,
        domain,
        contact_name: data.name,
        contact_email: data.email,
        instagram_handle: data.instagramHandle ?? null,
        facebook_page_url: data.facebookPageUrl ?? null,
        youtube_channel: data.youtubeChannel ?? null,
        google_maps_url: data.googleMapsUrl ?? null,
        viability_profile_json: enrichment.profile,
        overall_score: overall.score,
        overall_grade: overall.grade,
        category_scores_json: categoryScores,
        explanations_json: explanations,
        ip_hash: ipHash,
        retry_pending: retryPending,
        retry_signals_json: retryPending ? enrichment.failed_signals : null,
        created_at: new Date(),
      });

      // Pipeline + follow-up + PDF (non-blocking for SSE stream)
      const pipeline = await createAuditDeal({
        businessName: data.businessName,
        domain,
        contactName: data.name,
        contactEmail: data.email,
        submissionId,
      });

      await db
        .update(auditSubmissions)
        .set({
          deal_id: pipeline.dealResult.deal.id,
          company_id: pipeline.dealResult.company.id,
          contact_id: pipeline.dealResult.contact.id,
        })
        .where(eq(auditSubmissions.id, submissionId));

      const weakest = categoryScores
        .filter((c) => c.available)
        .reduce((min, c) => (c.score < min.score ? c : min), categoryScores[0]);

      // Fire and forget follow-up + PDF delivery
      Promise.allSettled([
        generateAuditFollowUp({
          contactName: data.name,
          contactEmail: data.email,
          companyName: data.businessName,
          domain,
          categoryScores,
          weakestCategory: weakest,
          viabilityProfile: enrichment.profile,
          dealId: pipeline.dealResult.deal.id,
          companyId: pipeline.dealResult.company.id,
          contactId: pipeline.dealResult.contact.id,
        }),
        deliverAuditReport({
          businessName: data.businessName,
          date: new Date().toLocaleDateString("en-AU", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          overall,
          categories: categoryScores,
          explanations,
          recommendations: {},
          contactEmail: data.email,
          contactName: data.name,
          companyId: pipeline.dealResult.company.id,
          contactId: pipeline.dealResult.contact.id,
          dealId: pipeline.dealResult.deal.id,
          submissionId,
        }).then(async (result) => {
          if (result.emailSent) {
            await db
              .update(auditSubmissions)
              .set({
                pdf_generated_at: new Date(),
                pdf_emailed_at: new Date(),
              })
              .where(eq(auditSubmissions.id, submissionId));
          }
        }),
      ]).catch(() => null);

      // Final results event
      sendEvent("complete", {
        submissionId,
        overall,
        categories: categoryScores,
        explanations,
        availableCount,
        retryPending,
        failedSignals: enrichment.failed_signals,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
