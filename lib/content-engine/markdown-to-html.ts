/**
 * Shared markdown-to-HTML converter for blog rendering and syndication.
 * Handles headings, paragraphs, bold, italic, links, lists, code blocks,
 * blockquotes, tables, and horizontal rules.
 *
 * Owner: CE-3 (blog render) + CE-14 (syndication).
 */

export function markdownToHtml(md: string): string {
  const blocks = md.split(/\n\n+/);
  const outputBlocks: string[] = [];

  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i].trim();
    if (!block) { i++; continue; }

    if (block.startsWith("```")) {
      let codeBlock = block;
      while (
        !codeBlock.endsWith("```") ||
        codeBlock === "```" ||
        (codeBlock.match(/```$/g)?.length === 1 && codeBlock.startsWith("```"))
      ) {
        if (codeBlock !== block || !codeBlock.slice(3).includes("```")) {
          i++;
          if (i < blocks.length) codeBlock += "\n\n" + blocks[i];
          else break;
        } else break;
      }
      const match = codeBlock.match(/^```(\w*)\n([\s\S]*?)```$/);
      if (match) {
        outputBlocks.push(
          `<pre><code class="language-${match[1]}">${escapeHtml(match[2].trim())}</code></pre>`,
        );
      } else {
        outputBlocks.push(
          `<pre><code>${escapeHtml(codeBlock.replace(/^```\w*\n?/, "").replace(/```$/, "").trim())}</code></pre>`,
        );
      }
      i++;
      continue;
    }

    if (/^---+$/.test(block)) {
      outputBlocks.push("<hr />");
      i++;
      continue;
    }

    if (block.includes("|") && block.split("\n").length >= 2) {
      const lines = block.split("\n").filter((l) => l.trim());
      const isSepLine = (l: string) => /^\|?[\s-:|]+\|?$/.test(l.trim());
      if (lines.length >= 2 && isSepLine(lines[1])) {
        const parseRow = (l: string) =>
          l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => inlineMarkdown(c.trim()));
        const headerCells = parseRow(lines[0]);
        const thead = `<thead><tr>${headerCells.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
        const bodyRows = lines.slice(2).map((l) => {
          const cells = parseRow(l);
          return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
        });
        outputBlocks.push(`<table>${thead}<tbody>${bodyRows.join("")}</tbody></table>`);
        i++;
        continue;
      }
    }

    if (block.startsWith(">")) {
      const quoteLines = block.split("\n").map((l) => l.replace(/^>\s?/, ""));
      outputBlocks.push(`<blockquote><p>${inlineMarkdown(quoteLines.join(" "))}</p></blockquote>`);
      i++;
      continue;
    }

    if (block.startsWith("### ")) {
      outputBlocks.push(`<h3>${inlineMarkdown(block.slice(4))}</h3>`);
      i++;
      continue;
    }
    if (block.startsWith("## ")) {
      outputBlocks.push(`<h2>${inlineMarkdown(block.slice(3))}</h2>`);
      i++;
      continue;
    }
    if (block.startsWith("# ")) {
      outputBlocks.push(`<h1>${inlineMarkdown(block.slice(2))}</h1>`);
      i++;
      continue;
    }

    if (/^[-*] /.test(block)) {
      const items = block.split("\n")
        .filter((l) => /^[-*] /.test(l.trim()))
        .map((l) => `<li>${inlineMarkdown(l.replace(/^[-*] /, ""))}</li>`);
      outputBlocks.push(`<ul>${items.join("")}</ul>`);
      i++;
      continue;
    }

    if (/^\d+\.\s/.test(block)) {
      const items = block.split("\n")
        .filter((l) => /^\d+\.\s/.test(l.trim()))
        .map((l) => `<li>${inlineMarkdown(l.replace(/^\d+\.\s/, ""))}</li>`);
      outputBlocks.push(`<ol>${items.join("")}</ol>`);
      i++;
      continue;
    }

    outputBlocks.push(`<p>${inlineMarkdown(block.replace(/\n/g, " "))}</p>`);
    i++;
  }

  return outputBlocks.join("\n");
}

export function inlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*] /gm, "")
    .replace(/^\d+\.\s/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
