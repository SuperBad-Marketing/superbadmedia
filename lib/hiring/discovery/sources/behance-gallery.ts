import * as cheerio from "cheerio";
import settings from "@/lib/settings";
import type { RoleBriefRow } from "@/lib/db/schema/role-briefs";
import type { DiscoverySource, DiscoverySourceResult } from "../types";
import { logDiscoveryCall } from "../log";

const BEHANCE_GALLERY_URL = "https://www.behance.net/galleries";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 1_024_000;

function extractTags(brief: RoleBriefRow): string[] {
  const val = brief.extracted_tags_json;
  if (Array.isArray(val)) return val.filter((v) => typeof v === "string");
  return [];
}

function matchesAnySeed(
  title: string,
  description: string,
  tags: string[],
): boolean {
  const haystack = `${title} ${description}`.toLowerCase();
  return tags.some((tag) => haystack.includes(tag.replace(/-/g, " ")));
}

export const behanceGallerySource: DiscoverySource = {
  name: "behance-gallery",

  async fetch(brief: RoleBriefRow): Promise<DiscoverySourceResult> {
    const enabled = await settings.get("hiring.discovery.behance_enabled");
    if (!enabled) return { urls: [], cost_aud: 0 };

    const start = Date.now();
    try {
      const response = await fetch(BEHANCE_GALLERY_URL, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; SuperBadBot/1.0; +https://superbadmedia.com.au)",
        },
      });

      if (!response.ok) {
        await logDiscoveryCall(
          "hiring-discovery-behance-gallery",
          Date.now() - start,
          0,
        );
        return { urls: [], cost_aud: 0 };
      }

      const buffer = await response.arrayBuffer();
      const html = new TextDecoder().decode(buffer.slice(0, MAX_BODY_BYTES));
      const $ = cheerio.load(html);

      const briefTags = extractTags(brief);
      const urls: string[] = [];

      $("a[href*='/gallery/']").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;

        const fullUrl = href.startsWith("http")
          ? href
          : `https://www.behance.net${href}`;

        const title = $(el).text().trim();
        const parentText = $(el).parent()?.text()?.trim() ?? "";

        if (matchesAnySeed(title, parentText, briefTags)) {
          if (!urls.includes(fullUrl)) urls.push(fullUrl);
        }
      });

      await logDiscoveryCall(
        "hiring-discovery-behance-gallery",
        Date.now() - start,
        0,
        { matches: urls.length },
      );

      return { urls, cost_aud: 0 };
    } catch {
      await logDiscoveryCall(
        "hiring-discovery-behance-gallery",
        Date.now() - start,
        0,
      );
      return { urls: [], cost_aud: 0 };
    }
  },
};
