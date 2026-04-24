"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MessageSquare, X, Send, Loader2 } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: string[];
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const EASE = "cubic-bezier(0.16,1,0.3,1)";

export function AiChatFab() {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
        className="fixed bottom-6 left-6 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg outline-none transition-colors"
        style={{
          background: "var(--color-brand-red)",
          color: "var(--color-brand-cream)",
        }}
        whileHover={reducedMotion ? {} : { scale: 1.08 }}
        whileTap={reducedMotion ? {} : { scale: 0.95 }}
        transition={houseSpring}
      >
        <MessageSquare size={20} strokeWidth={1.5} />
      </motion.button>

      <AnimatePresence>
        {open && <ChatPanel onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const reducedMotion = useReducedMotion();

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { id: uid(), role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setActiveTool(null);

    try {
      const chatHistory = nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/lite/cockpit-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistory }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to connect to assistant.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const toolsUsed: string[] = [];
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventName = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventName = line.slice(7);
          } else if (line.startsWith("data: ") && eventName) {
            try {
              const data = JSON.parse(line.slice(6));

              if (eventName === "tool_call") {
                const toolLabel = formatToolName(data.name);
                toolsUsed.push(toolLabel);
                setActiveTool(toolLabel);
              } else if (eventName === "text") {
                assistantText = data.content;
                setActiveTool(null);
              } else if (eventName === "error") {
                assistantText = `Error: ${data.message}`;
                setActiveTool(null);
              }
            } catch {
              // skip malformed JSON
            }
            eventName = "";
          }
        }
      }

      const assistantMsg: Message = {
        id: uid(),
        role: "assistant",
        content: assistantText,
        toolCalls: toolsUsed.length ? toolsUsed : undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content:
            err instanceof Error
              ? err.message
              : "Something went wrong. Try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setActiveTool(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -20, y: 20 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -20, y: 20 }}
      transition={houseSpring}
      className="fixed bottom-20 left-6 z-50 flex flex-col overflow-hidden rounded-2xl shadow-2xl"
      style={{
        width: "min(420px, calc(100vw - 48px))",
        height: "min(600px, calc(100vh - 120px))",
        background: "var(--color-surface-1)",
        border: "1px solid rgba(253, 245, 230, 0.08)",
        boxShadow:
          "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(253, 245, 230, 0.03)",
      }}
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between px-5 py-4"
        style={{
          borderBottom: "1px solid rgba(253, 245, 230, 0.06)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{
              background: "rgba(178, 40, 72, 0.15)",
              color: "var(--color-brand-pink)",
            }}
          >
            <MessageSquare size={14} strokeWidth={1.5} />
          </div>
          <div>
            <span
              className="block font-[family-name:var(--font-body)] text-[14px] font-medium"
              style={{ color: "var(--color-brand-cream)" }}
            >
              Assistant
            </span>
            <span
              className="block font-[family-name:var(--font-narrative)] text-[11px] italic"
              style={{ color: "var(--color-neutral-500)" }}
            >
              {isLoading
                ? activeTool
                  ? `checking ${activeTool}…`
                  : "thinking…"
                : "ask me anything"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close assistant"
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
          style={{ color: "var(--color-neutral-500)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--color-brand-cream)";
            e.currentTarget.style.background = "rgba(253, 245, 230, 0.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--color-neutral-500)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4"
        style={{ scrollBehavior: "smooth" }}
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                background: "rgba(178, 40, 72, 0.1)",
                color: "var(--color-brand-pink)",
              }}
            >
              <MessageSquare size={20} strokeWidth={1.5} />
            </div>
            <p
              className="max-w-[260px] font-[family-name:var(--font-body)] text-[13px]"
              style={{ color: "var(--color-neutral-400)" }}
            >
              Pipeline, tasks, finance, clients — ask about anything in the
              platform, or tell me to create something.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 py-1">
                <Loader2
                  size={14}
                  className="animate-spin"
                  style={{ color: "var(--color-brand-pink)" }}
                />
                <span
                  className="font-[family-name:var(--font-narrative)] text-[12px] italic"
                  style={{ color: "var(--color-neutral-500)" }}
                >
                  {activeTool
                    ? `checking ${activeTool}…`
                    : "thinking…"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="shrink-0 px-4 pb-4 pt-2"
        style={{
          borderTop: "1px solid rgba(253, 245, 230, 0.06)",
        }}
      >
        <div
          className="flex items-end gap-2 rounded-xl px-3 py-2"
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid rgba(253, 245, 230, 0.06)",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask something…"
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none bg-transparent font-[family-name:var(--font-body)] text-[14px] leading-[1.5] outline-none placeholder:text-[color:var(--color-neutral-600)] disabled:opacity-50"
            style={{
              color: "var(--color-brand-cream)",
              maxHeight: "120px",
              scrollbarWidth: "none",
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-150 disabled:opacity-30"
            style={{
              background: input.trim()
                ? "var(--color-brand-red)"
                : "transparent",
              color: input.trim()
                ? "var(--color-brand-cream)"
                : "var(--color-neutral-500)",
              transitionTimingFunction: EASE,
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[85%] rounded-2xl px-4 py-3"
        style={{
          background: isUser
            ? "var(--color-brand-red)"
            : "var(--color-surface-2)",
          color: isUser
            ? "var(--color-brand-cream)"
            : "var(--color-neutral-200)",
          borderBottomRightRadius: isUser ? "6px" : undefined,
          borderBottomLeftRadius: !isUser ? "6px" : undefined,
        }}
      >
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div
            className="mb-2 flex flex-wrap gap-1.5"
          >
            {message.toolCalls.map((tool, i) => (
              <span
                key={i}
                className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[8px] uppercase"
                style={{
                  letterSpacing: "1px",
                  background: "rgba(253, 245, 230, 0.06)",
                  color: "var(--color-neutral-500)",
                  border: "1px solid rgba(253, 245, 230, 0.06)",
                }}
              >
                {tool}
              </span>
            ))}
          </div>
        )}
        <div
          className="font-[family-name:var(--font-body)] text-[13px] leading-[1.6] whitespace-pre-wrap"
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  list_deals: "pipeline",
  get_deal_details: "deal",
  list_tasks: "tasks",
  get_finance_summary: "finance",
  list_recent_expenses: "expenses",
  list_clients: "clients",
  get_calendar_today: "calendar",
  list_quotes: "quotes",
  create_task: "creating task",
  add_expense: "adding expense",
};

function formatToolName(name: string): string {
  return TOOL_LABELS[name] ?? name;
}
