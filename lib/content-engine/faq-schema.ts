/**
 * Extract FAQ pairs from blog post markdown for JSON-LD FAQPage schema.
 * Looks for H2/H3 headings that are questions (contain "?") and pairs
 * them with the following paragraph as the answer.
 *
 * Owner: CE-14 (v1.1 AI search optimization).
 */
import { stripMarkdown } from "./markdown-to-html";

export interface FaqPair {
  question: string;
  answer: string;
}

export function extractFaqPairs(markdown: string): FaqPair[] {
  const blocks = markdown.split(/\n\n+/);
  const pairs: FaqPair[] = [];

  for (let i = 0; i < blocks.length - 1; i++) {
    const block = blocks[i].trim();
    const headingMatch = block.match(/^#{2,3}\s+(.+\?)\s*$/);
    if (!headingMatch) continue;

    const question = headingMatch[1].trim();
    const nextBlock = blocks[i + 1]?.trim();
    if (!nextBlock || nextBlock.startsWith("#")) continue;

    const answer = stripMarkdown(nextBlock).slice(0, 500);
    if (answer.length < 20) continue;

    pairs.push({ question, answer });
  }

  return pairs;
}

export function buildFaqSchema(
  pairs: FaqPair[],
): Record<string, unknown> | null {
  if (pairs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map((p) => ({
      "@type": "Question",
      name: p.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: p.answer,
      },
    })),
  };
}
