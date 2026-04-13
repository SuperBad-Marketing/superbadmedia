"use client";

/**
 * CookieConsentBanner — geo-gated GDPR/UK-GDPR consent UI.
 *
 * EU visitors: full banner with Reject All / Accept All / Manage Categories.
 * Non-EU visitors: permanent footer link to /lite/legal/cookie-policy.
 *
 * Motion: banner slides up from bottom using `houseSpring`. Category panel
 * expand/collapse uses `houseSpring`. Reduced-motion parity via `initial={false}`
 * and Framer AnimatePresence.
 *
 * Consent persistence: localStorage key `sb_cookie_consent` for instant
 * client-side reads. Also POSTs to /api/cookie-consent for EU audit trail.
 *
 * Owner: B3. Spec: docs/specs/legal-pages.md §4.
 */

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { houseSpring } from "@/lib/design-tokens";

/** Version string must match the cookie_policy legal_doc_versions row. */
const BANNER_VERSION = "1.0";
const STORAGE_KEY = "sb_cookie_consent";

export type CookieConsentState = {
  accepted: boolean;
  categories: string[];
  timestamp: number;
  version: string;
};

const ALL_OPTIONAL_CATEGORIES = ["functional", "analytics"] as const;

function readStoredConsent(): CookieConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsentState;
  } catch {
    return null;
  }
}

function writeStoredConsent(state: CookieConsentState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable (private browsing, storage full) — safe no-op
  }
}

async function recordConsent(state: CookieConsentState): Promise<void> {
  try {
    await fetch("/api/cookie-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accepted: state.accepted,
        categories: state.categories,
        banner_version: state.version,
      }),
    });
  } catch {
    // Non-blocking — consent still saved to localStorage even if POST fails
  }
}

interface CookieConsentBannerProps {
  /** Server-side EU detection result. Controls whether to show the full banner. */
  isEu: boolean;
}

export function CookieConsentBanner({ isEu }: CookieConsentBannerProps) {
  // Start visible for EU users so SSR HTML includes the banner markup.
  // After hydration, hide if consent already stored in localStorage.
  const [visible, setVisible] = React.useState(isEu);
  const [showCategories, setShowCategories] = React.useState(false);
  const [categorySelections, setCategorySelections] = React.useState<
    Record<string, boolean>
  >({
    functional: false,
    analytics: false,
  });

  // Hydrate from localStorage on mount — hide banner if already decided.
  React.useEffect(() => {
    if (!isEu) return;
    const existing = readStoredConsent();
    if (existing) {
      setVisible(false);
    }
  }, [isEu]);

  function handleAcceptAll() {
    const state: CookieConsentState = {
      accepted: true,
      categories: ["necessary", ...ALL_OPTIONAL_CATEGORIES],
      timestamp: Date.now(),
      version: BANNER_VERSION,
    };
    writeStoredConsent(state);
    void recordConsent(state);
    setVisible(false);
  }

  function handleRejectAll() {
    const state: CookieConsentState = {
      accepted: false,
      categories: ["necessary"],
      timestamp: Date.now(),
      version: BANNER_VERSION,
    };
    writeStoredConsent(state);
    void recordConsent(state);
    setVisible(false);
  }

  function handleSavePreferences() {
    const selected = (Object.entries(categorySelections) as [string, boolean][])
      .filter(([, on]) => on)
      .map(([cat]) => cat);
    const state: CookieConsentState = {
      accepted: selected.length > 0,
      categories: ["necessary", ...selected],
      timestamp: Date.now(),
      version: BANNER_VERSION,
    };
    writeStoredConsent(state);
    void recordConsent(state);
    setVisible(false);
  }

  function toggleCategory(cat: string) {
    setCategorySelections((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  // Non-EU: footer link only
  if (!isEu) {
    return (
      <p className="text-xs text-foreground/50 text-center py-2">
        We use cookies.{" "}
        <Link
          href="/lite/legal/cookie-policy"
          className="underline underline-offset-2 hover:text-foreground/70 transition-colors"
        >
          Details
        </Link>
      </p>
    );
  }

  // EU: full banner with AnimatePresence
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          key="cookie-banner"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={houseSpring}
          className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg"
          role="dialog"
          aria-label="Cookie consent"
          aria-modal="false"
        >
          <div className="mx-auto max-w-3xl px-4 py-4">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium mb-1">Cookies</p>
                <p className="text-xs text-foreground/70">
                  We use cookies to keep you signed in and remember your
                  preferences. Optional cookies help us monitor errors. See our{" "}
                  <Link
                    href="/lite/legal/cookie-policy"
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Cookie Policy
                  </Link>
                  .
                </p>
              </div>

              {/* Category panel */}
              <AnimatePresence initial={false}>
                {showCategories && (
                  <motion.div
                    key="categories"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={houseSpring}
                    className="overflow-hidden"
                  >
                    <div className="border border-border rounded-md divide-y divide-border">
                      {/* Necessary (always on) */}
                      <div className="flex items-center justify-between px-3 py-2">
                        <div>
                          <p className="text-xs font-medium">
                            Strictly necessary
                          </p>
                          <p className="text-xs text-foreground/60">
                            Session, auth, your consent choice.
                          </p>
                        </div>
                        <span className="text-xs text-foreground/50 italic">
                          Always on
                        </span>
                      </div>
                      {/* Functional */}
                      <div className="flex items-center justify-between px-3 py-2">
                        <div>
                          <p className="text-xs font-medium">Functionality</p>
                          <p className="text-xs text-foreground/60">
                            Theme, motion, and sound preferences.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={categorySelections.functional}
                          onClick={() => toggleCategory("functional")}
                          className={`w-8 h-4 rounded-full transition-colors relative ${
                            categorySelections.functional
                              ? "bg-primary"
                              : "bg-muted-foreground/30"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                              categorySelections.functional
                                ? "translate-x-4"
                                : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </div>
                      {/* Analytics */}
                      <div className="flex items-center justify-between px-3 py-2">
                        <div>
                          <p className="text-xs font-medium">Analytics</p>
                          <p className="text-xs text-foreground/60">
                            Error monitoring via Sentry.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={categorySelections.analytics}
                          onClick={() => toggleCategory("analytics")}
                          className={`w-8 h-4 rounded-full transition-colors relative ${
                            categorySelections.analytics
                              ? "bg-primary"
                              : "bg-muted-foreground/30"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                              categorySelections.analytics
                                ? "translate-x-4"
                                : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowCategories((v) => !v)}
                  className="flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground transition-colors"
                  aria-expanded={showCategories}
                >
                  Manage categories
                  {showCategories ? (
                    <ChevronUpIcon className="w-3 h-3" />
                  ) : (
                    <ChevronDownIcon className="w-3 h-3" />
                  )}
                </button>
                <div className="flex gap-2">
                  {showCategories && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSavePreferences}
                    >
                      Save preferences
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRejectAll}
                  >
                    Reject all
                  </Button>
                  <Button size="sm" onClick={handleAcceptAll}>
                    Accept all
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
