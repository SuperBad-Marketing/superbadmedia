/**
 * Strips quoted reply chains, forwarded blocks, and email signatures
 * from plain-text email bodies. Returns only the new message content.
 */

const QUOTE_HEADER_PATTERNS = [
  // "On Apr 30, 2026, at 10:00 AM, Person wrote:"
  /^On .{10,80} wrote:\s*$/m,
  // "On 30/04/2026 10:00 AM, Person <email> wrote:"
  /^On \d{1,2}\/\d{1,2}\/\d{2,4}.{5,60} wrote:\s*$/m,
  // Outlook: "From: ... Sent: ... To: ... Subject: ..."
  /^From:\s*.+\nSent:\s*.+\nTo:\s*.+/m,
  // Outlook alt: "From: ... Date: ... Subject: ... To: ..."
  /^From:\s*.+\n(?:Date|Sent):\s*.+\n(?:Subject|To):\s*.+/m,
  // Gmail: "---------- Forwarded message ----------"
  /^-{5,}\s*Forwarded message\s*-{5,}/m,
  // Generic: "-------- Original Message --------"
  /^-{4,}\s*Original Message\s*-{4,}/m,
  // Thunderbird / some clients: "> wrote:" line then ">" prefixed lines
  /^>.*wrote:\s*$/m,
];

const SIGNATURE_PATTERNS = [
  // "-- " (standard signature delimiter, note the trailing space)
  /^-- $/m,
  // "Kind Regards," / "Best regards," / "Regards," at line start
  /^(?:Kind |Best |Warm )?[Rr]egards,?\s*$/m,
  // "Cheers," / "Thanks," / "Thank you,"
  /^(?:Cheers|Thanks|Thank you|Many thanks),?\s*$/m,
  // "Sent from my iPhone" / "Sent from my Samsung" etc
  /^Sent from (?:my |a )/m,
  // "Get Outlook for" / "Download Outlook"
  /^(?:Get|Download) Outlook/m,
  // Common Australian sign-offs
  /^(?:Ta|Cheers mate),?\s*$/m,
];

// Lines that are purely quoted (start with >)
const QUOTED_LINE = /^>/;

export function trimQuotedContent(body: string | null): string {
  if (!body) return "";
  let text = body;

  // Find the earliest quote header and cut everything from there
  let earliestCut = text.length;

  for (const pattern of QUOTE_HEADER_PATTERNS) {
    const match = pattern.exec(text);
    if (match && match.index < earliestCut) {
      earliestCut = match.index;
    }
  }

  if (earliestCut < text.length) {
    text = text.slice(0, earliestCut);
  }

  // If the remaining text is mostly quoted lines (>), strip those too
  const lines = text.split("\n");
  const nonQuotedLines: string[] = [];
  let hitQuoteBlock = false;

  for (const line of lines) {
    if (QUOTED_LINE.test(line)) {
      hitQuoteBlock = true;
      continue;
    }
    if (hitQuoteBlock && line.trim() === "") continue;
    hitQuoteBlock = false;
    nonQuotedLines.push(line);
  }

  text = nonQuotedLines.join("\n");

  // Find earliest signature marker and cut
  let sigCut = text.length;
  for (const pattern of SIGNATURE_PATTERNS) {
    const match = pattern.exec(text);
    if (match && match.index < sigCut) {
      // Only cut if it's in the last ~40% of the message
      // (avoids false positives in short messages that mention "thanks")
      if (match.index > text.length * 0.3 || text.length < 200) {
        sigCut = match.index;
      }
    }
  }

  if (sigCut < text.length) {
    text = text.slice(0, sigCut);
  }

  // Clean up excessive whitespace
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text || body.slice(0, 500).trim();
}
