"use client";

/**
 * Embeddable opt-in form code generator panel (CE-11).
 *
 * Spec §4.2: "Embeddable opt-in form — HTML snippet styled with Brand DNA
 * visual tokens. Subscriber drops it on their website."
 *
 * Shows the pre-generated embed code with a copy button.
 */

import { useState } from "react";
/**
 * Generate the embeddable opt-in form HTML snippet.
 * Pure function — no server dependencies.
 */
function generateEmbedCode(baseUrl: string, embedFormToken: string): string {
  const endpoint = `${baseUrl}/api/newsletter/subscribe`;
  return [
    `<form action="${endpoint}" method="POST" style="display:flex;gap:8px;max-width:400px;">`,
    `  <input type="hidden" name="token" value="${embedFormToken}" />`,
    `  <input type="email" name="email" placeholder="Your email" required`,
    `    style="flex:1;padding:8px 12px;border:1px solid #d4d4d4;border-radius:6px;font-size:14px;" />`,
    `  <button type="submit"`,
    `    style="padding:8px 16px;background:#171717;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">`,
    `    Subscribe`,
    `  </button>`,
    `</form>`,
  ].join("\n");
}

interface EmbedCodePanelProps {
  embedFormToken: string | null;
  baseUrl: string;
}

export function EmbedCodePanel({ embedFormToken, baseUrl }: EmbedCodePanelProps) {
  const [copied, setCopied] = useState(false);

  if (!embedFormToken) {
    return (
      <div className="rounded-lg border border-border bg-background p-4">
        <h3 className="mb-2 text-sm font-medium">Embed form</h3>
        <p className="text-xs text-muted-foreground">
          No embed token configured. Complete the Content Engine onboarding
          wizard to generate one.
        </p>
      </div>
    );
  }

  const code = generateEmbedCode(baseUrl, embedFormToken);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium">Embed form</h3>
        <button
          onClick={handleCopy}
          className="rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-neutral-200"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Paste this on any website to collect newsletter subscribers.
      </p>
      <pre className="overflow-x-auto rounded-md bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-700">
        {code}
      </pre>
    </div>
  );
}
