import { runApifyActor } from "./apify-runner";

const ACTOR_ID = "apify~website-content-crawler";

interface RawCrawlItem {
  url?: string;
  text?: string;
  title?: string;
  description?: string;
  loadedAt?: string;
}

export interface WebsiteCrawlResult {
  pages: Array<{
    url: string;
    title: string | null;
    text: string;
  }>;
  error?: string;
}

export async function crawlWebsiteContent(
  domain: string,
): Promise<WebsiteCrawlResult> {
  try {
    const items = await runApifyActor<RawCrawlItem>({
      actorId: ACTOR_ID,
      jobName: "apify.website_crawler",
      estimatedCostAud: 0.03,
      maxPollAttempts: 15,
      input: {
        startUrls: [
          { url: `https://${domain}` },
          { url: `https://${domain}/about` },
          { url: `https://${domain}/services` },
          { url: `https://${domain}/about-us` },
        ],
        maxCrawlDepth: 1,
        maxCrawlPages: 6,
        crawlerType: "cheerio",
      },
    });

    if (items.length === 0) {
      return { pages: [] };
    }

    const pages = items
      .filter((item) => item.text && item.text.length > 50)
      .map((item) => ({
        url: item.url ?? "",
        title: item.title ?? null,
        text: truncateText(item.text!, 3000),
      }));

    return { pages };
  } catch (err) {
    return {
      pages: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "...";
}
