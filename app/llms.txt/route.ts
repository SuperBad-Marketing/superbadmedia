/**
 * `llms.txt` — plain-text site description for LLM crawlers.
 * Multi-tenant: resolves company from request hostname.
 * Lists published blog posts with titles and URLs.
 *
 * Owner: CE-14 (v1.1 AI search optimization).
 */
import { headers } from "next/headers";
import { resolveCompanyByDomain, listPublishedPosts } from "@/lib/content-engine/publish";

export async function GET(): Promise<Response> {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "";

  const cleanHost = host.replace(/:\d+$/, "");
  let company = await resolveCompanyByDomain(cleanHost);

  if (!company) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const appHost = appUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (cleanHost === appHost.replace(/:\d+$/, "")) {
      company = await resolveCompanyByDomain(appHost);
    }
  }

  if (!company) {
    return new Response("# llms.txt\n\n> No site found for this domain.\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const posts = await listPublishedPosts(company.id);

  const lines: string[] = [
    `# ${company.name}`,
    "",
    `> Blog and insights from ${company.name}.`,
    "",
  ];

  if (posts.length > 0) {
    lines.push("## Blog Posts", "");
    for (const post of posts) {
      const url = post.published_url ?? `https://${company.domain}/blog/${post.slug}`;
      const desc = post.meta_description ? `: ${post.meta_description}` : "";
      lines.push(`- [${post.title}](${url})${desc}`);
    }
    lines.push("");
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
