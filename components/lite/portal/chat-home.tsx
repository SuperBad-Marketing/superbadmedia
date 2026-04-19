"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import { markTourComplete } from "@/app/lite/portal/[token]/actions";

interface ChatMessage {
  id: number;
  role: "client" | "assistant";
  content: string;
  escalated_to_inbox: boolean;
  created_at_ms: number;
}

interface ChatHomeProps {
  contactName: string;
  initialMessages: ChatMessage[];
  initialRemainingToday: number;
  dailyLimit: number;
  tourSeen: boolean;
  kickoffVariant?: boolean;
}

export function ChatHome({
  contactName,
  initialMessages,
  initialRemainingToday,
  dailyLimit,
  tourSeen,
  kickoffVariant = false,
}: ChatHomeProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [remainingToday, setRemainingToday] = useState(initialRemainingToday);
  const [openingLine, setOpeningLine] = useState<string | null>(null);
  const [openingLoading, setOpeningLoading] = useState(true);
  const [showTour, setShowTour] = useState(!tourSeen);
  const [tourStep, setTourStep] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const scrollToBottom = useCallback(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, openingLine, scrollToBottom]);

  useEffect(() => {
    let cancelled = false;
    async function fetchOpening() {
      try {
        const res = await fetch("/api/lite/portal/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "opening_line", kickoffVariant }),
        });
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { openingLine: string };
          setOpeningLine(data.openingLine);
        }
      } catch {
        if (!cancelled) {
          setOpeningLine(
            `${contactName.split(" ")[0]}, welcome back. What can I help with?`,
          );
        }
      } finally {
        if (!cancelled) setOpeningLoading(false);
      }
    }
    fetchOpening();
    return () => {
      cancelled = true;
    };
  }, [contactName]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    if (remainingToday <= 0) {
      setRateLimited(true);
      return;
    }

    setInput("");
    setSending(true);

    const optimistic: ChatMessage = {
      id: Date.now(),
      role: "client",
      content: text,
      escalated_to_inbox: false,
      created_at_ms: Date.now(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch("/api/lite/portal/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (res.status === 429) {
        setRateLimited(true);
        setRemainingToday(0);
        return;
      }

      if (res.ok) {
        const data = (await res.json()) as {
          reply: string;
          escalated: boolean;
          remainingToday: number;
        };
        const assistant: ChatMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: data.reply,
          escalated_to_inbox: data.escalated,
          created_at_ms: Date.now(),
        };
        setMessages((prev) => [...prev, assistant]);
        setRemainingToday(data.remainingToday);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content:
          "Something went sideways on my end. Try again in a moment, or reach Andy at andy@superbadmedia.com.au.",
        escalated_to_inbox: false,
        created_at_ms: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(ms: number): string {
    const d = new Date(ms);
    return d.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  const fadeUp = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: houseSpring,
      };

  const TOUR_STEPS = [
    {
      title: "This is your space",
      body: "Ask me anything about your account. I've got the whole picture.",
    },
    {
      title: "Everything else",
      body: "Tap the menu for deliverables, invoices, your brand profile, and the rest.",
    },
    { title: "That's it", body: "Go on. I'll be here." },
  ];

  return (
    <div className="flex h-full flex-1 flex-col">
      {/* Chat thread */}
      <div
        ref={threadRef}
        className="flex-1 overflow-y-auto px-4 pb-4 pt-8 md:px-8"
      >
        <div className="mx-auto flex max-w-[780px] flex-col gap-4">
          {/* Opening line */}
          <AnimatePresence>
            {openingLoading ? (
              <motion.div
                key="opening-loading"
                {...fadeUp}
                className="flex flex-col gap-1.5"
              >
                <div className="animate-pulse rounded-2xl rounded-tl-md border border-[rgba(253,245,230,0.06)] bg-[rgba(253,245,230,0.04)] px-[18px] py-[14px]">
                  <div className="h-4 w-48 rounded bg-[var(--color-neutral-700)]" />
                </div>
              </motion.div>
            ) : openingLine ? (
              <motion.div
                key="opening"
                {...fadeUp}
                className="flex flex-col gap-2"
              >
                <p className="max-w-[620px] font-[family-name:var(--font-playfair-display)] text-[22px] italic leading-[1.3] text-[var(--color-foreground)] md:text-[26px]">
                  {openingLine}
                </p>
                <p className="text-[13px] italic text-[var(--color-neutral-500)]" data-ambient-slot="portal_chat_subtitle">
                  ask me anything about your work with us, or tap the menu for
                  the rest of your room.
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Message thread */}
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id}
              {...(shouldReduceMotion
                ? {}
                : {
                    initial: { opacity: 0, y: 12 },
                    animate: { opacity: 1, y: 0 },
                    transition: {
                      ...houseSpring,
                      delay: i < initialMessages.length ? 0 : 0.1,
                    },
                  })}
              className={`flex flex-col gap-[5px] ${
                msg.role === "client"
                  ? "max-w-[440px] items-end self-end"
                  : "max-w-[560px]"
              }`}
            >
              <div
                className={`rounded-[18px] px-[18px] py-[14px] text-[15px] leading-[1.55] ${
                  msg.role === "client"
                    ? "rounded-tr-md bg-[var(--color-brand-red)] text-[var(--color-brand-cream)]"
                    : "rounded-tl-md border border-[rgba(253,245,230,0.06)] bg-[rgba(253,245,230,0.04)] text-[var(--color-neutral-300)]"
                }`}
              >
                {msg.content}
              </div>
              <span
                className={`px-2 font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[1.5px] ${
                  msg.role === "client"
                    ? "text-[var(--color-brand-pink)]"
                    : "text-[var(--color-neutral-500)]"
                }`}
              >
                {msg.role === "client" ? "you" : "superbad"} ·{" "}
                {formatTime(msg.created_at_ms)}
              </span>
            </motion.div>
          ))}

          {/* Typing indicator */}
          <AnimatePresence>
            {sending && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={houseSpring}
                className="flex max-w-[560px] flex-col gap-[5px]"
              >
                <div className="rounded-[18px] rounded-tl-md border border-[rgba(253,245,230,0.06)] bg-[rgba(253,245,230,0.04)] px-[18px] py-[14px]">
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-neutral-500)]" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-neutral-500)] [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-neutral-500)] [animation-delay:300ms]" />
                  </div>
                </div>
                <span className="px-2 font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[1.5px] text-[var(--color-neutral-500)]">
                  superbad · thinking
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Composer */}
      <div className="mx-auto w-full max-w-[780px] px-4 pb-20 pt-3 sm:pb-6 md:px-8">
        <div
          className={`flex items-center gap-3 rounded-full border bg-[var(--color-neutral-800)] px-[22px] py-1.5 transition-colors duration-300 ${
            rateLimited
              ? "border-[var(--color-brand-orange)]"
              : "border-[rgba(253,245,230,0.08)] focus-within:border-[rgba(244,160,176,0.35)]"
          }`}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending || rateLimited}
            placeholder={
              rateLimited
                ? "you've hit today's limit. back tomorrow."
                : "ask, or say thanks, or go on a tangent. it's your room."
            }
            className="flex-1 border-none bg-transparent py-3 font-[family-name:var(--font-dm-sans)] text-[15px] italic text-[var(--color-brand-cream)] placeholder:text-[var(--color-neutral-500)] focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim() || rateLimited}
            aria-label="send"
            className="grid h-[38px] w-[38px] place-items-center rounded-full bg-[var(--color-brand-red)] text-[var(--color-brand-cream)] transition-transform duration-200 hover:scale-[1.06] disabled:opacity-40"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="mt-2.5 flex justify-between px-5 text-[12px] italic text-[var(--color-neutral-500)]">
          <span data-ambient-slot="portal_chat_footer">the bartender reads your whole history. always.</span>
          {!rateLimited && remainingToday <= 5 && (
            <span>
              {remainingToday} message{remainingToday !== 1 ? "s" : ""} left
              today
            </span>
          )}
        </div>
      </div>

      {/* First-visit tour */}
      <AnimatePresence>
        {showTour && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={houseSpring}
              className="flex max-w-sm flex-col gap-6 rounded-2xl border border-[rgba(253,245,230,0.08)] bg-[var(--color-surface-1)] p-8 text-center"
            >
              <div className="flex flex-col gap-2">
                <h2 className="font-[family-name:var(--font-righteous)] text-xs uppercase tracking-[2px] text-[var(--color-brand-orange)]">
                  {tourStep + 1} of {TOUR_STEPS.length}
                </h2>
                <p className="font-[family-name:var(--font-playfair-display)] text-xl italic text-[var(--color-foreground)]">
                  {TOUR_STEPS[tourStep].title}
                </p>
                <p className="text-sm text-[var(--color-neutral-300)]">
                  {TOUR_STEPS[tourStep].body}
                </p>
              </div>
              <button
                onClick={() => {
                  if (tourStep < TOUR_STEPS.length - 1) {
                    setTourStep(tourStep + 1);
                  } else {
                    setShowTour(false);
                    markTourComplete();
                    inputRef.current?.focus();
                  }
                }}
                className="rounded-full bg-[var(--color-brand-red)] px-6 py-2.5 font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[1.5px] text-[var(--color-brand-cream)] transition-colors hover:bg-[#8F1D3A]"
              >
                {tourStep < TOUR_STEPS.length - 1 ? "Next" : "Got it"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
