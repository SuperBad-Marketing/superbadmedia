"use client";

/**
 * Split-pane review surface — spec §2.1 Stage 4, §7.
 *
 * Left (~60%): rendered blog post preview (title, body, meta, slug).
 * Right (~40%): rejection chat thread + feedback input.
 *
 * All changes go through the rejection chat — no direct editing.
 * This preserves the drift-check pipeline (discipline #44).
 *
 * Owner: CE-3.
 */
import * as React from "react";
import { motion } from "framer-motion";
import { Check, MessageSquare, Send, Loader2 } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { approvePostAction, rejectPostAction } from "../actions";
import type { FeedbackMessage } from "@/lib/content-engine/review";

interface ReviewSplitPaneProps {
  post: {
    id: string;
    title: string;
    slug: string;
    body: string;
    meta_description: string | null;
    status: string;
    created_at_ms: number;
    updated_at_ms: number;
  };
  topic: {
    keyword: string;
  } | null;
  feedback: FeedbackMessage[];
}

export function ReviewSplitPane({
  post,
  topic,
  feedback: initialFeedback,
}: ReviewSplitPaneProps) {
  const [feedback, setFeedback] = React.useState(initialFeedback);
  const [feedbackInput, setFeedbackInput] = React.useState("");
  const [isApproving, setIsApproving] = React.useState(false);
  const [isRejecting, setIsRejecting] = React.useState(false);
  const [approveResult, setApproveResult] = React.useState<{
    ok: boolean;
    publishedUrl?: string;
    error?: string;
  } | null>(null);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feedback]);

  async function handleApprove() {
    setIsApproving(true);
    try {
      const result = await approvePostAction(post.id);
      setApproveResult(result);
    } finally {
      setIsApproving(false);
    }
  }

  async function handleReject() {
    if (!feedbackInput.trim()) return;
    setIsRejecting(true);
    try {
      // Optimistic: add user message immediately
      const userMsg: FeedbackMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: feedbackInput,
        createdAtMs: Date.now(),
      };
      setFeedback((prev) => [...prev, userMsg]);
      setFeedbackInput("");

      const result = await rejectPostAction(post.id, feedbackInput);

      if (result.ok) {
        // Add assistant response
        const assistantMsg: FeedbackMessage = {
          id: `temp-assistant-${Date.now()}`,
          role: "assistant",
          content: "Draft updated. Review the changes in the preview.",
          createdAtMs: Date.now(),
        };
        setFeedback((prev) => [...prev, assistantMsg]);
      }
    } finally {
      setIsRejecting(false);
    }
  }

  const isReviewable = post.status === "in_review";

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* Left pane — rendered preview (~60%) */}
      <motion.div
        className="flex w-[60%] shrink-0 flex-col overflow-y-auto rounded-lg border border-border bg-background p-6"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={houseSpring}
      >
        <div className="mb-4 flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {post.status}
          </Badge>
          {topic && (
            <span className="text-xs text-muted-foreground">
              Keyword: {topic.keyword}
            </span>
          )}
        </div>

        <h1 className="mb-2 text-2xl font-bold tracking-tight">
          {post.title}
        </h1>

        {post.meta_description && (
          <p className="mb-4 text-sm text-muted-foreground italic">
            {post.meta_description}
          </p>
        )}

        <div className="mb-2 text-xs text-muted-foreground">
          Slug: <code className="rounded bg-surface-1 px-1">/{post.slug}</code>
        </div>

        <hr className="my-4 border-border" />

        {/* Markdown preview */}
        <div className="prose prose-neutral max-w-none text-sm dark:prose-invert">
          <MarkdownPreview body={post.body} />
        </div>
      </motion.div>

      {/* Right pane — rejection chat (~40%) */}
      <motion.div
        className="flex w-[40%] flex-col rounded-lg border border-border bg-background"
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={houseSpring}
      >
        {/* Chat header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Feedback</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {feedback.filter((f) => f.role === "user").length} revision
            {feedback.filter((f) => f.role === "user").length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Chat thread */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {feedback.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No feedback yet. Type below to request changes.
            </p>
          )}
          {feedback.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-accent-cta/10 text-foreground"
                    : "bg-surface-1 text-foreground"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Approve result banner */}
        {approveResult && (
          <div
            className={`mx-4 mb-2 rounded-md px-3 py-2 text-sm ${
              approveResult.ok
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {approveResult.ok
              ? approveResult.publishedUrl
                ? `Published at ${approveResult.publishedUrl}`
                : "Approved (publishing pending)"
              : `Error: ${approveResult.error}`}
          </div>
        )}

        {/* Actions */}
        {isReviewable && (
          <div className="border-t border-border px-4 py-3 space-y-2">
            <div className="flex gap-2">
              <Textarea
                placeholder="Describe what to change..."
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
                className="min-h-[60px] resize-none text-sm"
                disabled={isRejecting}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleReject();
                  }
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleReject}
                disabled={!feedbackInput.trim() || isRejecting}
                className="flex-1"
              >
                {isRejecting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                )}
                Revise
              </Button>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isApproving}
                className="flex-1"
              >
                {isApproving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                )}
                Approve & Publish
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/** Simple markdown-to-HTML for the preview pane. */
function MarkdownPreview({ body }: { body: string }) {
  const html = React.useMemo(() => markdownToHtml(body), [body]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function markdownToHtml(md: string): string {
  let html = md
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_m, lang: string, code: string) =>
        `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`,
    )
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^---$/gm, "<hr />")
    .replace(/\n\n/g, "</p><p>");

  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
  html = html.replace(/<\/ul>\s*<ul>/g, "");

  if (!html.startsWith("<")) {
    html = `<p>${html}</p>`;
  }
  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
