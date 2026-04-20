import * as cheerio from "cheerio";
import settings from "@/lib/settings";
import type { RoleBriefRow } from "@/lib/db/schema/role-briefs";
import type { DiscoverySource, DiscoverySourceResult } from "../types";
import { logDiscoveryCall } from "../log";

const VIMEO_STAFF_PICKS_RSS =
  "https://vimeo.com/channels/staffpicks/videos/rss";
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

export const vimeoStaffPicksSource: DiscoverySource = {
  name: "vimeo-staff-picks",

  async fetch(brief: RoleBriefRow): Promise<DiscoverySourceResult> {
    const enabled = await settings.get("hiring.discovery.vimeo_enabled");
    if (!enabled) return { urls: [], cost_aud: 0 };

    const start = Date.now();
    try {
      const response = await fetch(VIMEO_STAFF_PICKS_RSS, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; SuperBadBot/1.0; +https://superbadmedia.com.au)",
        },
      });

      if (!response.ok) {
        await logDiscoveryCall(
          "hiring-discovery-vimeo-rss",
          Date.now() - start,
          0,
        );
        return { urls: [], cost_aud: 0 };
      }

      const buffer = await response.arrayBuffer();
      const xml = new TextDecoder().decode(buffer.slice(0, MAX_BODY_BYTES));
      const $ = cheerio.load(xml, { xml: true });

      const briefTags = extractTags(brief);
      const urls: string[] = [];

      $("item").each((_, el) => {
        const link = $(el).find("link").text().trim();
        const title = $(el).find("title").text().trim();
        const description = $(el).find("description").text().trim();

        if (link && matchesAnySeed(title, description, briefTags)) {
          urls.push(link);
        }
      });

      await logDiscoveryCall(
        "hiring-discovery-vimeo-rss",
        Date.now() - start,
        0,
        { items_checked: $("item").length, matches: urls.length },
      );

      return { urls, cost_aud: 0 };
    } catch {
      await logDiscoveryCall(
        "hiring-discovery-vimeo-rss",
        Date.now() - start,
        0,
      );
      return { urls: [], cost_aud: 0 };
    }
  },
};
