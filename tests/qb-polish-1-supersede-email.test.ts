import { describe, it, expect } from "vitest";
import {
  buildDraftSendEmailPrompt,
  type QuoteSendEmailInput,
} from "@/lib/ai/prompts/quote-builder/draft-send-email";

const base: QuoteSendEmailInput = {
  recipientName: "Sam",
  companyName: "Acme",
  structure: "retainer",
  totalDisplay: "$2,400 / month inc GST",
  termLine: "6-month honour-based commitment",
  scopeSummary: "content engine, outreach, monthly shoot",
  quoteUrl: "https://superbadmedia.com.au/lite/quotes/abc",
  contextSnippet: "tired of agencies that disappear between meetings",
  supersedesQuoteNumber: null,
};

describe("QB-POLISH-1 — supersede send-email variant", () => {
  it("prompt omits the REPLACEMENT block when supersedesQuoteNumber is null", () => {
    const prompt = buildDraftSendEmailPrompt(base);
    expect(prompt).not.toContain("REPLACEMENT");
    expect(prompt).not.toContain("replaces");
  });

  it("prompt includes the REPLACEMENT block naming the old quote number", () => {
    const prompt = buildDraftSendEmailPrompt({
      ...base,
      supersedesQuoteNumber: "SB-2026-0041",
    });
    expect(prompt).toContain("REPLACEMENT");
    expect(prompt).toContain("replaces SB-2026-0041");
    expect(prompt).toContain("dry and factual");
    expect(prompt).toContain("No apology loop");
  });

  it("prompt REPLACEMENT block tells the LLM to name the replacement up front", () => {
    const prompt = buildDraftSendEmailPrompt({
      ...base,
      supersedesQuoteNumber: "SB-2026-0041",
    });
    expect(prompt).toMatch(/first paragraph/i);
  });
});
