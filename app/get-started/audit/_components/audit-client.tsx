"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoryScore {
  category: string;
  score: number;
  grade: string;
  available: boolean;
}

interface OverallScore {
  score: number;
  grade: string;
}

type CategoryExplanations = Record<string, string>;

interface AuditResult {
  submissionId: string;
  overall: OverallScore;
  categories: CategoryScore[];
  explanations: CategoryExplanations;
  availableCount: number;
  retryPending: boolean;
  failedSignals: string[];
}

type Phase = "form" | "processing" | "reveal" | "degraded" | "error";

type SignalStatus = "queued" | "in-progress" | "complete" | "failed";

interface SignalLine {
  key: string;
  label: string;
  status: SignalStatus;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOUSE_SPRING = { type: "spring" as const, stiffness: 220, damping: 25, mass: 1 };

const SIGNAL_LABELS: Record<string, string> = {
  meta_ads: "Scanning ad activity",
  google_ads: "Checking Google Ads",
  google_maps: "Looking up your reputation",
  pagespeed: "Testing your website speed",
  whois: "Checking domain history",
  instagram: "Reviewing your Instagram",
  youtube: "Checking your YouTube",
  website_scrape: "Reading your website",
  maps_extras: "Gathering extra details",
};

const SIGNAL_ORDER = [
  "pagespeed",
  "website_scrape",
  "meta_ads",
  "google_ads",
  "instagram",
  "youtube",
  "google_maps",
  "maps_extras",
  "whois",
];

const CATEGORY_LABELS: Record<string, string> = {
  advertising: "Advertising Presence",
  social: "Social Presence",
  website: "Website Quality",
  reputation: "Online Reputation",
  content: "Content Activity",
};

const CATEGORY_ICONS: Record<string, string> = {
  advertising: "📢",
  social: "📱",
  website: "🌐",
  reputation: "⭐",
  content: "✍️",
};

function gradeColour(grade: string): string {
  if (grade.startsWith("A")) return "text-[#2d6a4f]";
  if (grade.startsWith("B")) return "text-[#b5651d]";
  if (grade.startsWith("C")) return "text-[#d4740e]";
  return "text-[#c1121f]";
}

function gradeBg(grade: string): string {
  if (grade.startsWith("A")) return "bg-[#2d6a4f]/10";
  if (grade.startsWith("B")) return "bg-[#b5651d]/10";
  if (grade.startsWith("C")) return "bg-[#d4740e]/10";
  return "bg-[#c1121f]/10";
}

function overallSummary(grade: string): string {
  if (grade.startsWith("A")) return "Your marketing is strong — here's the breakdown.";
  if (grade.startsWith("B")) return "Your marketing is decent — here's where it gets interesting.";
  if (grade.startsWith("C")) return "Your marketing is patchy — here's the honest breakdown.";
  return "Your marketing is thin — but now you know where to start.";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuditClient() {
  const [phase, setPhase] = useState<Phase>("form");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<SignalLine[]>([]);
  const [showOptional, setShowOptional] = useState(false);
  const [gradeRevealed, setGradeRevealed] = useState(false);
  const [categoriesRevealed, setCategoriesRevealed] = useState(false);

  // Form fields
  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [facebookPageUrl, setFacebookPageUrl] = useState("");
  const [youtubeChannel, setYoutubeChannel] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!businessName.trim() || !websiteUrl.trim() || !contactName.trim() || !email.trim()) return;

      setPhase("processing");
      setError(null);
      setResult(null);
      setGradeRevealed(false);
      setCategoriesRevealed(false);

      const initialSignals: SignalLine[] = SIGNAL_ORDER.map((key) => ({
        key,
        label: SIGNAL_LABELS[key] ?? key,
        status: "queued" as const,
      }));
      setSignals(initialSignals);

      abortRef.current = new AbortController();

      try {
        const turnstileToken = await getTurnstileToken();

        const resp = await fetch("/api/audit/submit-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessName: businessName.trim(),
            websiteUrl: websiteUrl.trim(),
            name: contactName.trim(),
            email: email.trim(),
            instagramHandle: instagramHandle.trim() || null,
            facebookPageUrl: facebookPageUrl.trim() || null,
            youtubeChannel: youtubeChannel.trim() || null,
            googleMapsUrl: googleMapsUrl.trim() || null,
            turnstileToken,
            honeypot: "",
          }),
          signal: abortRef.current.signal,
        });

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({ error: "Something went wrong." }));
          setError(body.error ?? "Something went wrong.");
          setPhase("error");
          return;
        }

        const reader = resp.body?.getReader();
        if (!reader) {
          setError("Connection failed. Please try again.");
          setPhase("error");
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let activeSignalIndex = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ") && eventType) {
              const payload = JSON.parse(line.slice(6));
              handleSSEEvent(eventType, payload, activeSignalIndex, (idx) => {
                activeSignalIndex = idx;
              });
              eventType = "";
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("Something went wrong. Please try again.");
        setPhase("error");
      }
    },
    [businessName, websiteUrl, contactName, email, instagramHandle, facebookPageUrl, youtubeChannel, googleMapsUrl],
  );

  const handleSSEEvent = useCallback(
    (
      event: string,
      payload: Record<string, unknown>,
      activeIdx: number,
      setActiveIdx: (idx: number) => void,
    ) => {
      if (event === "signal") {
        const signalName = payload.signal as string;
        const status = payload.status as "complete" | "failed";

        setSignals((prev) => {
          const next = [...prev];
          const idx = next.findIndex((s) => s.key === signalName);
          if (idx >= 0) {
            next[idx] = { ...next[idx], status };
          }
          // Mark next queued signal as in-progress
          const nextQueued = next.findIndex((s, i) => i > idx && s.status === "queued");
          if (nextQueued >= 0) {
            next[nextQueued] = { ...next[nextQueued], status: "in-progress" };
            setActiveIdx(nextQueued);
          }
          return next;
        });
      } else if (event === "started") {
        // Mark first signal as in-progress
        setSignals((prev) => {
          const next = [...prev];
          if (next.length > 0) {
            next[0] = { ...next[0], status: "in-progress" };
          }
          return next;
        });
      } else if (event === "enrichment_complete") {
        // Mark all remaining queued as complete
        setSignals((prev) => prev.map((s) => (s.status === "queued" || s.status === "in-progress" ? { ...s, status: "complete" } : s)));
      } else if (event === "complete") {
        const auditResult: AuditResult = {
          submissionId: payload.submissionId as string,
          overall: payload.overall as OverallScore,
          categories: payload.categories as CategoryScore[],
          explanations: (payload.explanations ?? {}) as CategoryExplanations,
          availableCount: payload.availableCount as number,
          retryPending: payload.retryPending as boolean,
          failedSignals: (payload.failedSignals ?? []) as string[],
        };
        setResult(auditResult);

        if (auditResult.availableCount < 3) {
          setPhase("degraded");
        } else {
          // Beat: 1.5s pause, then reveal
          setTimeout(() => {
            setPhase("reveal");
            // Grade reveals after signals fade
            setTimeout(() => setGradeRevealed(true), 600);
            // Categories build in after grade settles
            setTimeout(() => setCategoriesRevealed(true), 1400);
          }, 1500);
        }
      }
    },
    [],
  );

  // Reset to form
  const handleReset = useCallback(() => {
    setPhase("form");
    setResult(null);
    setError(null);
    setSignals([]);
    setGradeRevealed(false);
    setCategoriesRevealed(false);
  }, []);

  return (
    <div>
      <AnimatePresence mode="wait">
        {phase === "form" && (
          <FormPhase
            key="form"
            businessName={businessName}
            setBusinessName={setBusinessName}
            websiteUrl={websiteUrl}
            setWebsiteUrl={setWebsiteUrl}
            contactName={contactName}
            setContactName={setContactName}
            email={email}
            setEmail={setEmail}
            instagramHandle={instagramHandle}
            setInstagramHandle={setInstagramHandle}
            facebookPageUrl={facebookPageUrl}
            setFacebookPageUrl={setFacebookPageUrl}
            youtubeChannel={youtubeChannel}
            setYoutubeChannel={setYoutubeChannel}
            googleMapsUrl={googleMapsUrl}
            setGoogleMapsUrl={setGoogleMapsUrl}
            showOptional={showOptional}
            setShowOptional={setShowOptional}
            onSubmit={handleSubmit}
          />
        )}

        {phase === "processing" && (
          <ProcessingPhase key="processing" signals={signals} />
        )}

        {phase === "reveal" && result && (
          <RevealPhase
            key="reveal"
            result={result}
            gradeRevealed={gradeRevealed}
            categoriesRevealed={categoriesRevealed}
            email={email}
            onReset={handleReset}
          />
        )}

        {phase === "degraded" && result && (
          <DegradedPhase key="degraded" result={result} email={email} onReset={handleReset} />
        )}

        {phase === "error" && (
          <ErrorPhase key="error" error={error} onReset={handleReset} />
        )}
      </AnimatePresence>

      {/* Turnstile widget (invisible mode) */}
      <div id="turnstile-container" className="hidden" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Turnstile helper
// ---------------------------------------------------------------------------

function getTurnstileToken(): Promise<string> {
  return new Promise((resolve) => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) {
      resolve("dev-bypass-token");
      return;
    }

    if (typeof window !== "undefined" && "turnstile" in window) {
      const turnstile = (window as unknown as Record<string, unknown>).turnstile as {
        render: (
          container: string | HTMLElement,
          opts: Record<string, unknown>,
        ) => void;
      };
      turnstile.render("#turnstile-container", {
        sitekey: siteKey,
        callback: (token: string) => resolve(token),
        "error-callback": () => resolve(""),
        size: "invisible",
      });
    } else {
      resolve("dev-bypass-token");
    }
  });
}

// ---------------------------------------------------------------------------
// Form phase
// ---------------------------------------------------------------------------

function FormPhase({
  businessName,
  setBusinessName,
  websiteUrl,
  setWebsiteUrl,
  contactName,
  setContactName,
  email,
  setEmail,
  instagramHandle,
  setInstagramHandle,
  facebookPageUrl,
  setFacebookPageUrl,
  youtubeChannel,
  setYoutubeChannel,
  googleMapsUrl,
  setGoogleMapsUrl,
  showOptional,
  setShowOptional,
  onSubmit,
}: {
  businessName: string;
  setBusinessName: (v: string) => void;
  websiteUrl: string;
  setWebsiteUrl: (v: string) => void;
  contactName: string;
  setContactName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  instagramHandle: string;
  setInstagramHandle: (v: string) => void;
  facebookPageUrl: string;
  setFacebookPageUrl: (v: string) => void;
  youtubeChannel: string;
  setYoutubeChannel: (v: string) => void;
  googleMapsUrl: string;
  setGoogleMapsUrl: (v: string) => void;
  showOptional: boolean;
  setShowOptional: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const canSubmit =
    businessName.trim() && websiteUrl.trim() && contactName.trim() && email.trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={HOUSE_SPRING}
    >
      <div className="space-y-4 text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
          Marketing Audit
        </h1>
        <p className="text-lg text-foreground/60">
          Find out where your marketing actually stands.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-12 space-y-5">
        <Field
          id="business-name"
          label="Business name"
          value={businessName}
          onChange={setBusinessName}
          placeholder="e.g. The Corner Bakery"
          required
        />
        <Field
          id="website-url"
          label="Website"
          type="url"
          value={websiteUrl}
          onChange={setWebsiteUrl}
          placeholder="e.g. thecornerbakery.com.au"
          required
        />
        <Field
          id="contact-name"
          label="Your name"
          value={contactName}
          onChange={setContactName}
          placeholder="e.g. Sam Chen"
          required
        />
        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="sam@thecornerbakery.com.au"
          required
        />

        {/* Honeypot */}
        <input
          type="text"
          name="website_url_confirm"
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />

        {/* Optional social fields */}
        <div>
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className="text-sm text-foreground/50 transition-colors hover:text-foreground/70"
          >
            {showOptional ? "− Hide social profiles" : "+ Add your social profiles for a more detailed report"}
          </button>

          <AnimatePresence>
            {showOptional && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-4">
                  <p className="text-xs text-foreground/40">
                    Each handle you provide lets us check a real signal instead of guessing.
                  </p>
                  <Field
                    id="instagram"
                    label="Instagram handle"
                    value={instagramHandle}
                    onChange={setInstagramHandle}
                    placeholder="@thecornerbakery"
                  />
                  <Field
                    id="facebook"
                    label="Facebook page URL"
                    value={facebookPageUrl}
                    onChange={setFacebookPageUrl}
                    placeholder="facebook.com/thecornerbakery"
                  />
                  <Field
                    id="youtube"
                    label="YouTube channel"
                    value={youtubeChannel}
                    onChange={setYoutubeChannel}
                    placeholder="@thecornerbakery or channel URL"
                  />
                  <Field
                    id="maps"
                    label="Google Maps listing URL"
                    value={googleMapsUrl}
                    onChange={setGoogleMapsUrl}
                    placeholder="maps.google.com link to your listing"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-brand-pink hover:bg-brand-pink/90 w-full rounded-lg px-6 py-3 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          Run my audit
        </button>

        <p className="text-center text-xs text-foreground/40">
          Takes about 20 seconds. We&apos;ll check your ads, your socials, your
          website, and your reputation — then grade you honestly.
        </p>
      </form>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Processing phase
// ---------------------------------------------------------------------------

function ProcessingPhase({ signals }: { signals: SignalLine[] }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-[60vh] flex-col items-center justify-center"
    >
      <h2 className="font-heading mb-8 text-xl font-semibold tracking-tight">
        Checking everything
      </h2>

      <div className="w-full max-w-sm space-y-3">
        {signals.map((signal) => (
          <motion.div
            key={signal.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={HOUSE_SPRING}
            className="flex items-center justify-between text-sm"
          >
            <span
              className={
                signal.status === "complete"
                  ? "text-foreground/60"
                  : signal.status === "failed"
                    ? "text-foreground/40 line-through"
                    : signal.status === "in-progress"
                      ? "text-foreground"
                      : "text-foreground/30"
              }
            >
              {signal.label}
            </span>
            <SignalIndicator status={signal.status} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function SignalIndicator({ status }: { status: SignalStatus }) {
  if (status === "complete") {
    return (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={HOUSE_SPRING}
        className="text-[#2d6a4f]"
      >
        ✓
      </motion.span>
    );
  }
  if (status === "failed") {
    return <span className="text-foreground/30">✕</span>;
  }
  if (status === "in-progress") {
    return (
      <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-brand-pink" />
    );
  }
  return <span className="inline-block h-2.5 w-2.5 rounded-full bg-foreground/10" />;
}

// ---------------------------------------------------------------------------
// Reveal phase
// ---------------------------------------------------------------------------

function RevealPhase({
  result,
  gradeRevealed,
  categoriesRevealed,
  email,
  onReset,
}: {
  result: AuditResult;
  gradeRevealed: boolean;
  categoriesRevealed: boolean;
  email: string;
  onReset: () => void;
}) {
  const availableCategories = result.categories.filter((c) => c.available);
  const unavailableCategories = result.categories.filter((c) => !c.available);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center"
    >
      {/* Overall grade */}
      <AnimatePresence>
        {gradeRevealed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={HOUSE_SPRING}
            className="text-center"
          >
            <div
              className={`inline-flex h-32 w-32 items-center justify-center rounded-2xl ${gradeBg(result.overall.grade)}`}
            >
              <span
                className={`font-heading text-7xl font-bold ${gradeColour(result.overall.grade)}`}
              >
                {result.overall.grade}
              </span>
            </div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, ...HOUSE_SPRING }}
              className="mt-4 text-base text-foreground/60"
            >
              {overallSummary(result.overall.grade)}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category cards */}
      <AnimatePresence>
        {categoriesRevealed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="mt-10 w-full space-y-4"
          >
            {availableCategories.map((cat, i) => (
              <motion.div
                key={cat.category}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.2, ...HOUSE_SPRING }}
                className="border-border rounded-xl border p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {CATEGORY_ICONS[cat.category] ?? "📊"}
                    </span>
                    <span className="text-sm font-medium">
                      {CATEGORY_LABELS[cat.category] ?? cat.category}
                    </span>
                  </div>
                  <span
                    className={`font-heading text-2xl font-bold ${gradeColour(cat.grade)}`}
                  >
                    {cat.grade}
                  </span>
                </div>
                {result.explanations[cat.category] && (
                  <p className="mt-3 text-sm leading-relaxed text-foreground/60">
                    {result.explanations[cat.category]}
                  </p>
                )}
              </motion.div>
            ))}

            {unavailableCategories.length > 0 && (
              <div className="space-y-3">
                {unavailableCategories.map((cat) => (
                  <div
                    key={cat.category}
                    className="border-border rounded-xl border border-dashed p-5 opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {CATEGORY_ICONS[cat.category] ?? "📊"}
                      </span>
                      <span className="text-sm font-medium">
                        {CATEGORY_LABELS[cat.category] ?? cat.category}
                      </span>
                      <span className="text-xs text-foreground/40">
                        — couldn&apos;t check this one
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: availableCategories.length * 0.2 + 0.3 }}
              className="pt-4 text-center"
            >
              <p className="text-sm text-foreground/40">
                A PDF of this report is on its way to{" "}
                <span className="text-foreground/60">{email}</span>.
                Keep it, forward it, or come back any time.
              </p>
              <button
                type="button"
                onClick={onReset}
                className="mt-6 text-xs text-foreground/30 transition-colors hover:text-foreground/50"
              >
                Run another audit
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Degraded phase (fewer than 3 categories available)
// ---------------------------------------------------------------------------

function DegradedPhase({
  result,
  email,
  onReset,
}: {
  result: AuditResult;
  email: string;
  onReset: () => void;
}) {
  const available = result.categories.filter((c) => c.available);
  const failedLabels = result.failedSignals
    .map((s) => SIGNAL_LABELS[s] ?? s)
    .join(", ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={HOUSE_SPRING}
      className="space-y-6"
    >
      <div className="text-center">
        <h2 className="font-heading text-2xl font-bold tracking-tight">
          Partial results
        </h2>
        <p className="mt-2 text-sm text-foreground/60">
          We couldn&apos;t get a complete picture
          {failedLabels ? ` — ${failedLabels.toLowerCase()} didn't come back` : ""}.
          Your partial report is below, and we&apos;ll email you a full version
          once we can check the rest.
        </p>
      </div>

      {available.length > 0 && (
        <div className="space-y-4">
          {available.map((cat) => (
            <div key={cat.category} className="border-border rounded-xl border p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {CATEGORY_ICONS[cat.category] ?? "📊"}
                  </span>
                  <span className="text-sm font-medium">
                    {CATEGORY_LABELS[cat.category] ?? cat.category}
                  </span>
                </div>
                <span
                  className={`font-heading text-2xl font-bold ${gradeColour(cat.grade)}`}
                >
                  {cat.grade}
                </span>
              </div>
              {result.explanations[cat.category] && (
                <p className="mt-3 text-sm leading-relaxed text-foreground/60">
                  {result.explanations[cat.category]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-center">
        <p className="text-sm text-foreground/40">
          We&apos;ll send the full report to{" "}
          <span className="text-foreground/60">{email}</span> when it&apos;s ready.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-6 text-xs text-foreground/30 transition-colors hover:text-foreground/50"
        >
          Try again
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Error phase
// ---------------------------------------------------------------------------

function ErrorPhase({
  error,
  onReset,
}: {
  error: string | null;
  onReset: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={HOUSE_SPRING}
      className="text-center"
    >
      <div className="border-border rounded-xl border p-8">
        <p className="text-sm text-foreground/60">
          {error ?? "Something went wrong. Please try again."}
        </p>
        <button
          type="button"
          onClick={onReset}
          className="bg-brand-pink hover:bg-brand-pink/90 mt-6 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors"
        >
          Start over
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Shared field component
// ---------------------------------------------------------------------------

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-foreground/70"
      >
        {label}
        {required && <span className="ml-0.5 text-brand-pink">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-border bg-surface-1 w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors focus:border-brand-pink"
        required={required}
        maxLength={type === "url" ? 500 : 200}
      />
    </div>
  );
}
