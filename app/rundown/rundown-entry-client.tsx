"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { houseSpring } from "@/lib/design-tokens";
import { submitRundownEntry, type RundownEntryInput } from "./actions";

const BRAND_OBSERVATIONS = [
  "Most businesses know what they do. Almost none know how they sound.",
  "Your brand isn't your logo. It's the thing people say about you when you leave the room.",
  "Good marketing starts with knowing who you are. Everything else is just volume.",
  "The difference between a brand and a business is that one of them people remember.",
  "You don't need more content. You need content that sounds like you.",
  "Every brand has a voice. Most just haven't stopped to listen to it.",
  "The best brands don't try to appeal to everyone. They appeal to the right people, deeply.",
];

interface TurnstileApi {
  render: (el: string | HTMLElement, opts: Record<string, unknown>) => string;
  getResponse: (widgetId: string) => string | undefined;
  reset: (widgetId: string) => void;
  execute: (container: string | HTMLElement, opts?: Record<string, unknown>) => void;
}

function getTurnstile(): TurnstileApi | null {
  if (typeof window === "undefined" || !("turnstile" in window)) return null;
  return (window as unknown as { turnstile: TurnstileApi }).turnstile;
}

function requestTurnstileToken(api: TurnstileApi, widgetId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const existing = api.getResponse(widgetId);
    if (existing) { resolve(existing); return; }
    api.reset(widgetId);
    const timeout = setTimeout(() => reject(new Error("timeout")), 15000);
    const poll = setInterval(() => {
      const token = api.getResponse(widgetId);
      if (token) { clearTimeout(timeout); clearInterval(poll); resolve(token); }
    }, 200);
  });
}

interface PrefilledData {
  name?: string;
  email?: string;
  businessName?: string;
  website?: string;
  instagramHandle?: string;
}

export function RundownEntryClient({ prefilled }: { prefilled?: PrefilledData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState(prefilled?.name ?? "");
  const [email, setEmail] = useState(prefilled?.email ?? "");
  const [businessName, setBusinessName] = useState(prefilled?.businessName ?? "");
  const [website, setWebsite] = useState(prefilled?.website ?? "");
  const [instagramHandle, setInstagramHandle] = useState(prefilled?.instagramHandle ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClientOverride, setShowClientOverride] = useState(false);
  const [clientName, setClientName] = useState("");
  const [observationIndex, setObservationIndex] = useState(0);
  const turnstileWidgetId = useRef<string | null>(null);
  const turnstileToken = useRef<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setObservationIndex((prev) => (prev + 1) % BRAND_OBSERVATIONS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let attempts = 0;
    const tryRender = () => {
      const api = getTurnstile();
      const el = document.getElementById("turnstile-container");
      if (!api || !el) {
        if (attempts++ < 20) setTimeout(tryRender, 500);
        return;
      }
      turnstileWidgetId.current = api.render(el, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
        size: "invisible",
        callback: (token: string) => {
          turnstileToken.current = token;
        },
      });
    };
    tryRender();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setError(null);
      setSubmitting(true);

      try {
        const api = getTurnstile();
        if (!api || !turnstileWidgetId.current) {
          setError("Verification not ready. Please refresh and try again.");
          setSubmitting(false);
          return;
        }

        let token = turnstileToken.current ?? api.getResponse(turnstileWidgetId.current);
        if (!token) {
          try {
            token = await requestTurnstileToken(api, turnstileWidgetId.current);
          } catch {
            setError("Verification timed out. Please try again.");
            setSubmitting(false);
            return;
          }
        }

        const input: RundownEntryInput = {
          name: name.trim(),
          email: email.trim(),
          businessName: businessName.trim(),
          website: website.trim() || undefined,
          instagramHandle: instagramHandle.trim() || undefined,
          turnstileToken: token,
          utmSource: searchParams.get("utm_source") ?? undefined,
          utmMedium: searchParams.get("utm_medium") ?? undefined,
          utmCampaign: searchParams.get("utm_campaign") ?? undefined,
          referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
        };

        const result = await submitRundownEntry(input);

        if (result.ok) {
          router.push(`/rundown/s/${result.sessionToken}`);
          return;
        }

        if (result.reason === "existing_client") {
          setClientName(result.contactName);
          setShowClientOverride(true);
          return;
        }

        if (result.reason === "existing_rundown") {
          router.push(`/rundown/s/${result.sessionToken}`);
          return;
        }

        setError(result.message);
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setSubmitting(false);
        const api = getTurnstile();
        if (api && turnstileWidgetId.current) {
          turnstileToken.current = null;
          api.reset(turnstileWidgetId.current);
        }
      }
    },
    [name, email, businessName, website, instagramHandle, submitting, searchParams, router],
  );

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        background: "var(--brand-charcoal)",
      }}
    >
      {/* Left: form */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "clamp(32px, 6vw, 80px)",
          maxWidth: 600,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...houseSpring, duration: 0.8 }}
          style={{ display: "flex", flexDirection: "column", gap: 32 }}
        >
          <div>
            <p
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 10,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "var(--brand-pink)",
                margin: "0 0 12px 0",
              }}
            >
              Brand DNA
            </p>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                lineHeight: 1.05,
                color: "var(--brand-cream)",
                margin: 0,
              }}
            >
              Let&rsquo;s find out who you are.
            </h1>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 16,
                lineHeight: 1.6,
                color: "var(--brand-cream)",
                opacity: 0.6,
                margin: "16px 0 0 0",
              }}
            >
              An intensive deep dive into your brand, your business, and your strategy. You&rsquo;ll walk away with a complete brand identity profile and a Brand Pack you can actually use.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {showClientOverride ? (
              <ClientOverridePrompt
                key="override"
                clientName={clientName}
                onProceed={() => {
                  setShowClientOverride(false);
                  setError(null);
                }}
                onCancel={() => setShowClientOverride(false)}
              />
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: "flex", flexDirection: "column", gap: 20 }}
              >
                <InputField
                  label="Your name"
                  value={name}
                  onChange={setName}
                  required
                  autoFocus={!prefilled?.name}
                />
                <InputField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  required
                />
                <InputField
                  label="Business name"
                  value={businessName}
                  onChange={setBusinessName}
                  required
                />
                <InputField
                  label="Website"
                  type="url"
                  value={website}
                  onChange={setWebsite}
                  placeholder="if you don't have a website, leave this blank"
                />
                <InputField
                  label="Instagram"
                  value={instagramHandle}
                  onChange={setInstagramHandle}
                  placeholder="@yourbusiness"
                />

                {error && (
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 14,
                      color: "var(--brand-red)",
                      margin: 0,
                    }}
                  >
                    {error}
                  </p>
                )}

                <motion.button
                  type="submit"
                  disabled={submitting || !name.trim() || !email.trim() || !businessName.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={houseSpring}
                  style={{
                    fontFamily: "var(--font-label)",
                    fontSize: 11,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: "var(--brand-cream)",
                    background: "var(--brand-red)",
                    border: "none",
                    borderRadius: 12,
                    padding: "16px 32px",
                    cursor: submitting ? "wait" : "pointer",
                    opacity: submitting ? 0.6 : 1,
                    marginTop: 8,
                    transition: "opacity 0.2s",
                  }}
                >
                  {submitting ? "Setting up..." : "Start"}
                </motion.button>

                <div id="turnstile-container" />
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Right: ambient brand observations (hidden on mobile, takes full width below) */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(32px, 6vw, 80px)",
          position: "relative",
          overflow: "hidden",
        }}
        className="rundown-ambient-panel"
      >
        {/* Subtle gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 60% 50%, rgba(178, 40, 72, 0.08), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <AnimatePresence mode="wait">
          <motion.p
            key={observationIndex}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)",
              lineHeight: 1.5,
              color: "var(--brand-cream)",
              opacity: 0.5,
              textAlign: "center",
              maxWidth: 460,
              position: "relative",
            }}
          >
            {BRAND_OBSERVATIONS[observationIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      <style jsx global>{`
        @media (max-width: 768px) {
          main {
            flex-direction: column !important;
          }
          .rundown-ambient-panel {
            min-height: 200px !important;
            order: -1 !important;
            padding: 40px 24px !important;
          }
        }
      `}</style>
    </main>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  autoFocus = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={id}
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 10,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "var(--brand-cream)",
          opacity: 0.5,
        }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder}
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 16,
          color: "var(--brand-cream)",
          background: "rgba(253, 245, 230, 0.05)",
          border: "1px solid rgba(253, 245, 230, 0.1)",
          borderRadius: 10,
          padding: "14px 16px",
          outline: "none",
          transition: "border-color 0.2s",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "rgba(178, 40, 72, 0.4)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "rgba(253, 245, 230, 0.1)";
        }}
      />
    </div>
  );
}

function ClientOverridePrompt({
  clientName,
  onProceed,
  onCancel,
}: {
  clientName: string;
  onProceed: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={houseSpring}
      style={{
        background: "rgba(178, 40, 72, 0.1)",
        border: "1px solid rgba(178, 40, 72, 0.25)",
        borderRadius: 16,
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 16,
          lineHeight: 1.6,
          color: "var(--brand-cream)",
          margin: 0,
        }}
      >
        Hey {clientName.split(" ")[0]} &mdash; looks like you already have a Brand DNA profile with us. Taking this again will replace your current one.
      </p>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--brand-cream)",
          opacity: 0.6,
          margin: 0,
        }}
      >
        Your previous results will be archived, not deleted.
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={onProceed}
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 11,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--brand-cream)",
            background: "var(--brand-red)",
            border: "none",
            borderRadius: 10,
            padding: "12px 24px",
            cursor: "pointer",
          }}
        >
          Start fresh
        </button>
        <button
          onClick={onCancel}
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 11,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--brand-cream)",
            background: "transparent",
            border: "1px solid rgba(253, 245, 230, 0.15)",
            borderRadius: 10,
            padding: "12px 24px",
            cursor: "pointer",
          }}
        >
          Never mind
        </button>
      </div>
    </motion.div>
  );
}
