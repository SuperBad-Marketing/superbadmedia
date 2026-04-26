import { eq } from "drizzle-orm";
import type { ViabilityProfile } from "@/lib/lead-gen/types";
import {
  fetchPageSpeed,
  applyPageSpeedToProfile,
  fetchWhois,
  applyWhoisToProfile,
  fetchInstagram,
  applyInstagramToProfile,
  scrapeWebsite,
  applyWebsiteScrapeToProfile,
} from "@/lib/lead-gen/enrich";
import { db } from "@/lib/db";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";

interface FunnelEnrichmentInput {
  submissionId: string;
  businessName: string;
  domain: string | null;
  websiteUrl: string | null;
  instagramHandle: string | null;
}

export async function runFunnelEnrichment(
  input: FunnelEnrichmentInput,
): Promise<void> {
  const { submissionId, domain, websiteUrl, instagramHandle } = input;
  let profile: Partial<ViabilityProfile> = {};
  const fetchErrors: Record<string, string> = {};

  const tasks: Array<{ name: string; run: () => Promise<void> }> = [];

  if (domain) {
    tasks.push({
      name: "pagespeed",
      run: async () => {
        const result = await fetchPageSpeed(domain);
        if (result.error) {
          fetchErrors.pagespeed = result.error;
        } else {
          profile = applyPageSpeedToProfile(profile, result);
        }
      },
    });

    tasks.push({
      name: "whois",
      run: async () => {
        const result = await fetchWhois(domain);
        if (result.error) {
          fetchErrors.whois = result.error;
        } else {
          profile = applyWhoisToProfile(profile, result);
        }
      },
    });

    tasks.push({
      name: "instagram",
      run: async () => {
        const result = await fetchInstagram(
          domain,
          instagramHandle || undefined,
        );
        if (result.error) {
          fetchErrors.instagram = result.error;
        } else {
          profile = applyInstagramToProfile(profile, result);
        }
      },
    });
  } else if (instagramHandle) {
    tasks.push({
      name: "instagram",
      run: async () => {
        const result = await fetchInstagram(
          instagramHandle,
          instagramHandle,
        );
        if (result.error) {
          fetchErrors.instagram = result.error;
        } else {
          profile = applyInstagramToProfile(profile, result);
        }
      },
    });
  }

  if (websiteUrl) {
    tasks.push({
      name: "website_scrape",
      run: async () => {
        const result = await scrapeWebsite(websiteUrl);
        if (result.error) {
          fetchErrors.website_scrape = result.error;
        } else {
          profile = applyWebsiteScrapeToProfile(profile, result);
        }
      },
    });
  }

  if (tasks.length === 0) return;

  const results = await Promise.allSettled(tasks.map((t) => t.run()));

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "rejected") {
      fetchErrors[tasks[i].name] = String(r.reason);
    }
  }

  if (Object.keys(fetchErrors).length > 0) {
    (profile as Record<string, unknown>).fetch_errors = fetchErrors;
  }

  await db
    .update(intro_funnel_submissions)
    .set({
      viability_profile_json: profile as Record<string, unknown>,
      updated_at_ms: Date.now(),
    })
    .where(eq(intro_funnel_submissions.id, submissionId));
}
