"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Send, Loader2 } from "lucide-react";
import type { ProductionChatMessageRow } from "@/lib/db/schema/productions";
import {
  addChatMessageAction,
  saveChatResponseAction,
} from "../actions";

interface EpisodeChatProps {
  productionId: string;
  initialMessages: ProductionChatMessageRow[];
}

export function EpisodeChat({
  productionId,
  initialMessages,
}: EpisodeChatProps) {
  const [messages, setMessages] =
    React.useState<ProductionChatMessageRow[]>(initialMessages);
  const [input, setInput] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [streamingText, setStreamingText] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setIsStreaming(true);
    setStreamingText("");

    const userMsg = await addChatMessageAction(productionId, text);
    setMessages((prev) => [...prev, userMsg]);

    try {
      const allMessages = [...messages, userMsg].map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const res = await fetch("/api/lite/productions/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionId, messages: allMessages }),
      });

      if (!res.ok) throw new Error("Chat failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: text_delta")) continue;
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content && typeof data.content === "string") {
                fullText += data.content;
                setStreamingText(fullText);
              }
            } catch {
              // skip malformed lines
            }
          }
        }
      }

      if (fullText) {
        const assistantMsg = await saveChatResponseAction(
          productionId,
          fullText,
        );
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      console.error("Chat stream error:", err);
    } finally {
      setIsStreaming(false);
      setStreamingText("");
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && !isStreaming ? (
          <div className="flex h-full items-center justify-center">
            <p className="font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-neutral-500)]">
              start a conversation to brainstorm this episode.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={
                    reduceMotion ? false : { opacity: 0, y: 8 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.25, ease: "easeOut" }
                  }
                  className={`max-w-[85%] rounded-[10px] px-3.5 py-2.5 ${
                    msg.role === "user"
                      ? "ml-auto"
                      : "mr-auto"
                  }`}
                  style={{
                    background:
                      msg.role === "user"
                        ? "rgba(178, 40, 72, 0.25)"
                        : "rgba(253, 245, 230, 0.04)",
                  }}
                >
                  <p className="whitespace-pre-wrap font-[family-name:var(--font-body)] text-[13px] leading-relaxed text-[color:var(--color-neutral-300)]">
                    {msg.content}
                  </p>
                  <span
                    className="mt-1 block font-[family-name:var(--font-label)] text-[8px] uppercase text-[color:var(--color-neutral-600)]"
                    style={{ letterSpacing: "1px" }}
                  >
                    {msg.role === "user" ? "you" : "claude"}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Streaming response */}
            {isStreaming && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mr-auto max-w-[85%] rounded-[10px] px-3.5 py-2.5"
                style={{ background: "rgba(253, 245, 230, 0.04)" }}
              >
                {streamingText ? (
                  <p className="whitespace-pre-wrap font-[family-name:var(--font-body)] text-[13px] leading-relaxed text-[color:var(--color-neutral-300)]">
                    {streamingText}
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-3 animate-spin text-[color:var(--color-brand-pink)]" strokeWidth={1.5} />
                    <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                      Thinking…
                    </span>
                  </div>
                )}
                <span
                  className="mt-1 block font-[family-name:var(--font-label)] text-[8px] uppercase text-[color:var(--color-brand-pink)]"
                  style={{ letterSpacing: "1px" }}
                >
                  claude
                </span>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[color:rgba(253,245,230,0.06)] p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Brainstorm an angle, ask 'what if…'"
            rows={1}
            className="flex-1 resize-none rounded-[8px] border border-[color:rgba(253,245,230,0.06)] bg-[color:rgba(253,245,230,0.02)] px-3 py-2 font-[family-name:var(--font-body)] text-[13px] leading-relaxed text-[color:var(--color-neutral-300)] placeholder:text-[color:var(--color-neutral-600)] focus:border-[color:var(--color-brand-pink)] focus:outline-none"
            style={{
              transition: "border-color 180ms cubic-bezier(0.16,1,0.3,1)",
              maxHeight: "120px",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] border-none disabled:cursor-default disabled:opacity-30"
            style={{
              background: "var(--color-brand-red)",
              transition: "opacity 180ms",
            }}
            aria-label="Send message"
          >
            <Send className="size-3.5 text-[color:var(--color-brand-cream)]" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
