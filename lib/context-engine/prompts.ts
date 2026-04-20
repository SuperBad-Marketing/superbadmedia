import type { AssembledContext, ExtractionContext } from "./assemble";
import type { ActionItemRow } from "@/lib/db/schema/action-items";

const SUMMARY_TOKEN_CAP = 4000;
const EXTRACTION_TOKEN_CAP = 2000;
const DRAFT_TOKEN_CAP = 8000;
const NUDGE_TOKEN_CAP = 10000;
const REFORMAT_TOKEN_CAP = 2000;

function truncateToApproxTokens(text: string, cap: number): string {
  const charBudget = cap * 4;
  if (text.length <= charBudget) return text;
  return text.slice(0, charBudget) + "\n[…truncated]";
}

export function formatSummaryPrompt(ctx: AssembledContext): {
  system: string;
  prompt: string;
} {
  const system = [
    "You are a concise business context summariser.",
    "Write a flat factual narrative paragraph about the current state of this business relationship.",
    "2–4 short sentences. No personality, no opinion, no dry wit. Just what's happening, what's pending, who owes what.",
    "Never reference yourself or that you are an AI. Write as if taking notes for a colleague.",
  ].join(" ");

  const parts: string[] = [];

  parts.push(`Contact: ${ctx.contact.name}`);
  if (ctx.contact.role) parts.push(`Role: ${ctx.contact.role}`);
  if (ctx.company) {
    parts.push(`Company: ${ctx.company.name}`);
    if (ctx.company.industry) parts.push(`Industry: ${ctx.company.industry}`);
  }

  if (ctx.currentDeal) {
    parts.push(
      `Deal stage: ${ctx.currentDeal.stage}` +
        (ctx.currentDeal.valueCents
          ? ` ($${(ctx.currentDeal.valueCents / 100).toFixed(2)})`
          : ""),
    );
    if (ctx.currentDeal.subscriptionState) {
      parts.push(`Subscription: ${ctx.currentDeal.subscriptionState}`);
    }
  }

  if (ctx.outstandingInvoices.length > 0) {
    parts.push(
      `Outstanding invoices: ${ctx.outstandingInvoices.map((i) => `${i.invoiceNumber} (${i.status})`).join(", ")}`,
    );
  }

  if (ctx.openActionItems.length > 0) {
    const yours = ctx.openActionItems.filter((a) => a.owner === "you");
    const theirs = ctx.openActionItems.filter((a) => a.owner === "them");
    parts.push(
      `Open action items: ${yours.length} yours, ${theirs.length} theirs`,
    );
    for (const item of ctx.openActionItems) {
      parts.push(`  - [${item.owner}] ${item.description}`);
    }
  }

  if (ctx.brandDna?.signalTags) {
    parts.push(`Brand DNA tags: ${ctx.brandDna.signalTags}`);
  }

  if (ctx.activeStrategy) {
    parts.push(
      `Active strategy: ${ctx.activeStrategy.status === "live" ? "live" : "pending review"}`,
    );
  }

  if (ctx.activityEntries.length > 0) {
    parts.push("\nRecent activity:");
    for (const entry of ctx.activityEntries.slice(0, 15)) {
      parts.push(`  - [${entry.kind}] ${entry.body}`);
    }
  }

  if (ctx.recentMessages.length > 0) {
    parts.push("\nRecent messages:");
    for (const msg of ctx.recentMessages) {
      const dir = msg.direction === "inbound" ? "FROM them" : "TO them";
      const subj = msg.subject ? ` (${msg.subject})` : "";
      parts.push(`  ${dir}${subj}: ${msg.bodyText.slice(0, 500)}`);
    }
  }

  const prompt = truncateToApproxTokens(parts.join("\n"), SUMMARY_TOKEN_CAP);

  return { system, prompt };
}

export function formatExtractionPrompt(
  ctx: ExtractionContext,
  existingOpenItems: Array<{ description: string; owner: string }>,
): { system: string; prompt: string } {
  const system = [
    "You extract action items (commitments, promises, next steps) from a single email message.",
    "Return a JSON array of objects: { description: string, owner: 'you' | 'them', due_date: string | null }.",
    "If there are no action items, return an empty array: [].",
    "Rules:",
    `- This is an ${ctx.direction} message.`,
    ctx.direction === "inbound"
      ? "- First person ('I will', 'we will') = owner is 'them'. Second person ('can you', 'could you') = owner is 'you'."
      : "- First person ('I will', 'we will') = owner is 'you'. Second person ('can you', 'could you') = owner is 'them'.",
    "- If ownership is ambiguous, default to 'you'.",
    "- For due_date: extract explicit dates ('by Tuesday', 'next Friday') as ISO 8601 (YYYY-MM-DD). Vague ('soon', 'when you can') = null.",
    "- One-line descriptions only. No elaboration.",
    "- Skip duplicates of existing open items listed below.",
    "- Return ONLY the JSON array, no other text.",
  ].join("\n");

  const parts: string[] = [];

  if (existingOpenItems.length > 0) {
    parts.push("Existing open action items (skip duplicates of these):");
    for (const item of existingOpenItems) {
      parts.push(`  - [${item.owner}] ${item.description}`);
    }
    parts.push("");
  }

  parts.push(`Message (${ctx.direction}):`);
  parts.push(ctx.messageBody);

  const prompt = truncateToApproxTokens(parts.join("\n"), EXTRACTION_TOKEN_CAP);

  return { system, prompt };
}

function formatContextBlock(ctx: AssembledContext): string {
  const parts: string[] = [];

  if (ctx.conversationSummary) {
    parts.push(`RELATIONSHIP SUMMARY:\n${ctx.conversationSummary}`);
  }

  parts.push(`CONTACT: ${ctx.contact.name}`);
  if (ctx.contact.role) parts.push(`Role: ${ctx.contact.role}`);
  if (ctx.company) {
    parts.push(`Company: ${ctx.company.name}`);
    if (ctx.company.industry) parts.push(`Industry: ${ctx.company.industry}`);
    if (ctx.company.location) parts.push(`Location: ${ctx.company.location}`);
  }

  if (ctx.currentDeal) {
    parts.push(
      `Deal: ${ctx.currentDeal.stage}` +
        (ctx.currentDeal.valueCents
          ? ` ($${(ctx.currentDeal.valueCents / 100).toFixed(0)})`
          : ""),
    );
  }

  if (ctx.outstandingInvoices.length > 0) {
    parts.push(
      `Outstanding invoices: ${ctx.outstandingInvoices.map((i) => `${i.invoiceNumber} (${i.status})`).join(", ")}`,
    );
  }

  if (ctx.openActionItems.length > 0) {
    parts.push("\nACTION ITEMS:");
    for (const item of ctx.openActionItems) {
      const due = item.dueDateMs
        ? ` (due ${new Date(item.dueDateMs).toISOString().slice(0, 10)})`
        : "";
      parts.push(`  - [${item.owner}] ${item.description}${due}`);
    }
  }

  if (ctx.activeStrategy?.status === "live" && ctx.activeStrategy.payloadJson) {
    parts.push(`\nACTIVE STRATEGY: live — see payload for current plan details.`);
  }

  return parts.join("\n");
}

function formatBrandDnaBlock(ctx: AssembledContext): string {
  if (!ctx.brandDna) return "";
  const parts: string[] = ["BRAND DNA:"];
  if (ctx.brandDna.prosePortrait) parts.push(ctx.brandDna.prosePortrait);
  if (ctx.brandDna.signalTags) parts.push(`Tags: ${ctx.brandDna.signalTags}`);
  return parts.join("\n");
}

function formatRecentMessages(msgs: AssembledContext["recentMessages"]): string {
  if (msgs.length === 0) return "";
  const parts = ["RECENT MESSAGES (newest first):"];
  for (const msg of msgs) {
    const dir = msg.direction === "inbound" ? "FROM THEM" : "FROM YOU";
    const subj = msg.subject ? ` — ${msg.subject}` : "";
    parts.push(`\n[${dir}${subj}]`);
    parts.push(msg.bodyText.slice(0, 1500));
  }
  return parts.join("\n");
}

export function formatDraftPrompt(ctx: AssembledContext): {
  system: string;
  prompt: string;
} {
  const isColdProspect = ctx.recentMessages.length === 0 && !ctx.conversationSummary;

  const system = [
    "You are writing an email on behalf of a marketing professional.",
    isColdProspect
      ? "This is a first-touch cold outreach. You have no prior relationship. Write a warm, natural introduction."
      : "Reply to the message below. Don't recap the conversation. Don't reference context unless the reply naturally requires it. Just respond the way a person who knows all of this would.",
    `Format for: ${ctx.contact.preferredChannel}.`,
    ctx.contact.preferredChannel === "email"
      ? "Include a greeting and sign-off appropriate to the relationship stage."
      : "Keep it brief — no greeting/sign-off formality.",
  ].join(" ");

  const parts: string[] = [];
  parts.push(formatContextBlock(ctx));

  const brandBlock = formatBrandDnaBlock(ctx);
  if (brandBlock) parts.push(brandBlock);

  const msgBlock = formatRecentMessages(ctx.recentMessages);
  if (msgBlock) parts.push(msgBlock);

  if (isColdProspect) {
    parts.push("\nWrite a first-contact email. Be genuine, specific to their business, and concise.");
  }

  const prompt = truncateToApproxTokens(parts.join("\n\n"), DRAFT_TOKEN_CAP);
  return { system, prompt };
}

export function formatNudgePrompt(
  ctx: AssembledContext,
  previousDraft: string,
  nudge: string,
  nudgeHistory: string[],
): { system: string; prompt: string } {
  const system = [
    "You are revising a draft email based on the sender's feedback.",
    "Apply the nudge instruction to the previous draft. Keep all context awareness. Don't recap the conversation.",
    `Format for: ${ctx.contact.preferredChannel}.`,
  ].join(" ");

  const parts: string[] = [];
  parts.push(formatContextBlock(ctx));

  const brandBlock = formatBrandDnaBlock(ctx);
  if (brandBlock) parts.push(brandBlock);

  const msgBlock = formatRecentMessages(ctx.recentMessages);
  if (msgBlock) parts.push(msgBlock);

  parts.push(`PREVIOUS DRAFT:\n${previousDraft}`);

  if (nudgeHistory.length > 0) {
    parts.push(`PREVIOUS NUDGES:\n${nudgeHistory.map((n, i) => `${i + 1}. ${n}`).join("\n")}`);
  }

  parts.push(`CURRENT NUDGE:\n${nudge}`);

  const prompt = truncateToApproxTokens(parts.join("\n\n"), NUDGE_TOKEN_CAP);
  return { system, prompt };
}

export function formatReformatPrompt(
  draftText: string,
  targetChannel: string,
): { system: string; prompt: string } {
  const system = [
    "You are reformatting an existing draft for a different communication channel.",
    "Preserve the message content, intent, and tone.",
    targetChannel === "email"
      ? "Expand for email: add an appropriate greeting and sign-off. Allow a natural paragraph structure."
      : "Compress for SMS: remove greeting/sign-off formality. Keep it under 160 characters if possible. Be direct.",
  ].join(" ");

  const prompt = truncateToApproxTokens(
    `Reformat the following draft for ${targetChannel}:\n\n${draftText}`,
    REFORMAT_TOKEN_CAP,
  );

  return { system, prompt };
}
