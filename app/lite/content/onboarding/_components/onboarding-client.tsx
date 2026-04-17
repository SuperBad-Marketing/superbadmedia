"use client";

/**
 * Content Engine onboarding wizard — client orchestrator (CE-12).
 *
 * Drives the three-step flow inside <WizardShell>. Each step is a custom
 * inline component (not the generic step-type registry) because the wizard
 * steps have Content-Engine-specific logic (keyword editing, send window
 * picker, CSV import toggle).
 *
 * Spec: docs/specs/content-engine.md §3.3.
 * Owner: CE-12.
 */
import * as React from "react";
import { WizardShell } from "@/components/lite/wizard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  initOnboardingAction,
  completeOnboardingAction,
} from "../actions";
import { SEND_WINDOW_DAYS } from "@/lib/db/schema/content-engine-config";

// ── Types ────────────────────────────────────────────────────────────────────

type SeedKeywordEntry = { keyword: string; source: string };

type OnboardingState = {
  step: number;
  companyId: string;
  configId: string | null;
  // Step 1
  domainVerified: boolean;
  // Step 2
  seedKeywords: SeedKeywordEntry[];
  newKeyword: string;
  // Step 3
  sendWindowDay: string;
  sendWindowTime: string;
  sendWindowTz: string;
  csvData: string | null;
  csvFilename: string | null;
  // Status
  loading: boolean;
  error: string | null;
  complete: boolean;
};

const STEP_LABELS = ["Domain setup", "Your topics", "Newsletter"];

const INITIAL_STATE: OnboardingState = {
  step: 0,
  companyId: "",
  configId: null,
  domainVerified: false,
  seedKeywords: [],
  newKeyword: "",
  sendWindowDay: "tuesday",
  sendWindowTime: "10:00",
  sendWindowTz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Australia/Melbourne",
  csvData: null,
  csvFilename: null,
  loading: false,
  error: null,
  complete: false,
};

// ── Component ────────────────────────────────────────────────────────────────

export function ContentEngineOnboardingClient({
  expiryDays,
  companyId: initialCompanyId,
}: {
  expiryDays: number;
  companyId?: string;
}) {
  const [state, setState] = React.useState<OnboardingState>({
    ...INITIAL_STATE,
    companyId: initialCompanyId ?? "",
  });

  // Initialise on mount — derive seed keywords
  React.useEffect(() => {
    if (!state.companyId || state.configId) return;
    let cancelled = false;

    async function init() {
      setState((s) => ({ ...s, loading: true, error: null }));
      const result = await initOnboardingAction(state.companyId);
      if (cancelled) return;
      if (!result.ok) {
        setState((s) => ({ ...s, loading: false, error: result.error }));
        return;
      }
      setState((s) => ({
        ...s,
        loading: false,
        configId: result.configId,
        seedKeywords: result.seedKeywords.sources,
      }));
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [state.companyId, state.configId]);

  const handleCancel = () => {
    // In a real implementation this would persist wizard_progress and close
    // the slideover. For now, reset to step 0.
    setState(INITIAL_STATE);
  };

  const handleNext = () => {
    setState((s) => ({ ...s, step: Math.min(s.step + 1, 2) }));
  };

  const handleBack = () => {
    setState((s) => ({ ...s, step: Math.max(s.step - 1, 0) }));
  };

  const handleComplete = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    const result = await completeOnboardingAction({
      companyId: state.companyId,
      seedKeywords: state.seedKeywords.map((k) => k.keyword),
      sendWindowDay: state.sendWindowDay as (typeof SEND_WINDOW_DAYS)[number],
      sendWindowTime: state.sendWindowTime,
      sendWindowTz: state.sendWindowTz,
      csvData: state.csvData ?? undefined,
    });

    if (!result.ok) {
      setState((s) => ({ ...s, loading: false, error: result.error }));
      return;
    }

    setState((s) => ({ ...s, loading: false, complete: true }));
  };

  if (state.complete) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
        <h2 className="font-heading text-2xl">Engine ready.</h2>
        <p className="text-sm text-muted-foreground">
          Your content engine is live. First draft incoming — we&apos;ll let you
          know when it&apos;s ready for review.
        </p>
      </div>
    );
  }

  return (
    <WizardShell
      wizardKey="content-engine-onboarding"
      currentStep={state.step}
      stepLabels={STEP_LABELS}
      audience="client"
      expiryDays={expiryDays}
      onCancel={handleCancel}
    >
      {state.error ? (
        <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      {state.step === 0 ? (
        <StepDomainVerification
          verified={state.domainVerified}
          onVerified={() => setState((s) => ({ ...s, domainVerified: true }))}
          onNext={handleNext}
        />
      ) : state.step === 1 ? (
        <StepSeedKeywordReview
          keywords={state.seedKeywords}
          newKeyword={state.newKeyword}
          onKeywordsChange={(keywords) =>
            setState((s) => ({ ...s, seedKeywords: keywords }))
          }
          onNewKeywordChange={(v) => setState((s) => ({ ...s, newKeyword: v }))}
          onBack={handleBack}
          onNext={handleNext}
        />
      ) : (
        <StepNewsletterPreferences
          sendWindowDay={state.sendWindowDay}
          sendWindowTime={state.sendWindowTime}
          sendWindowTz={state.sendWindowTz}
          csvFilename={state.csvFilename}
          onDayChange={(v) => setState((s) => ({ ...s, sendWindowDay: v }))}
          onTimeChange={(v) => setState((s) => ({ ...s, sendWindowTime: v }))}
          onTzChange={(v) => setState((s) => ({ ...s, sendWindowTz: v }))}
          onCsvLoad={(filename, data) =>
            setState((s) => ({ ...s, csvFilename: filename, csvData: data }))
          }
          onBack={handleBack}
          onComplete={handleComplete}
          loading={state.loading}
        />
      )}
    </WizardShell>
  );
}

// ── Step 1: Domain verification ─────────────────────────────────────────────

function StepDomainVerification({
  verified,
  onVerified,
  onNext,
}: {
  verified: boolean;
  onVerified: () => void;
  onNext: () => void;
}) {
  return (
    <div data-wizard-step="domain-verification" className="space-y-6">
      <div className="space-y-2">
        <h3 className="font-heading text-lg">Domain setup</h3>
        <p className="text-sm text-muted-foreground">
          We need to verify your domain so your blog and newsletter send from
          your own address. Add these DNS records — if you&apos;re not sure how,
          ask your web person to handle this one step.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium">Required DNS records</h4>
        <div className="space-y-2">
          <DnsRecordRow
            type="CNAME"
            name="blog"
            value="lite.superbadmedia.com.au"
            description="Blog hosting via Cloudflare path routing"
          />
          <DnsRecordRow
            type="TXT"
            name="@"
            value="v=spf1 include:amazonses.com ~all"
            description="SPF record for Resend email sending"
          />
          <DnsRecordRow
            type="CNAME"
            name="resend._domainkey"
            value="resend.domainkey.resend.dev"
            description="DKIM signing for newsletter delivery"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-4 py-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => {
              if (e.target.checked) onVerified();
            }}
            data-wizard-domain-confirm
          />
          I&apos;ve added these records (or my web person has)
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        DNS changes can take up to 48 hours to propagate. You can continue setup
        now — your blog and newsletter will start working once the records
        resolve.
      </p>

      <Button type="button" onClick={onNext} disabled={!verified}>
        Continue
      </Button>
    </div>
  );
}

function DnsRecordRow({
  type,
  name,
  value,
  description,
}: {
  type: string;
  name: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-md border px-3 py-2 text-sm" data-wizard-dns-record>
      <div className="flex items-center gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {type}
        </span>
        <span className="font-mono">{name}</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-mono text-xs break-all">{value}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

// ── Step 2: Seed keyword review ─────────────────────────────────────────────

function StepSeedKeywordReview({
  keywords,
  newKeyword,
  onKeywordsChange,
  onNewKeywordChange,
  onBack,
  onNext,
}: {
  keywords: SeedKeywordEntry[];
  newKeyword: string;
  onKeywordsChange: (keywords: SeedKeywordEntry[]) => void;
  onNewKeywordChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const handleRemove = (idx: number) => {
    onKeywordsChange([...keywords.slice(0, idx), ...keywords.slice(idx + 1)]);
  };

  const handleAdd = () => {
    const trimmed = newKeyword.trim().toLowerCase();
    if (!trimmed) return;
    if (keywords.some((k) => k.keyword === trimmed)) return;
    onKeywordsChange([...keywords, { keyword: trimmed, source: "manually added" }]);
    onNewKeywordChange("");
  };

  return (
    <div data-wizard-step="seed-keyword-review" className="space-y-6">
      <div className="space-y-2">
        <h3 className="font-heading text-lg">Your topics</h3>
        <p className="text-sm text-muted-foreground">
          We pulled these seed keywords from your Brand DNA and business
          details. They&apos;ll guide what your content engine writes about.
          Remove any that feel off, or add ones we missed.
        </p>
      </div>

      <div className="space-y-2">
        {keywords.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No keywords derived yet. Add some below.
          </p>
        ) : (
          keywords.map((entry, i) => (
            <div
              key={`${entry.keyword}-${i}`}
              className="flex items-center justify-between rounded-md border px-3 py-2"
              data-wizard-keyword
            >
              <div>
                <span className="text-sm font-medium">{entry.keyword}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {entry.source}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Remove ${entry.keyword}`}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={newKeyword}
          onChange={(e) => onNewKeywordChange(e.target.value)}
          placeholder="Add a keyword…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          data-wizard-keyword-input
        />
        <Button type="button" variant="outline" onClick={handleAdd}>
          Add
        </Button>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={keywords.length === 0}
        >
          These look right
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Newsletter preferences ──────────────────────────────────────────

function StepNewsletterPreferences({
  sendWindowDay,
  sendWindowTime,
  sendWindowTz,
  csvFilename,
  onDayChange,
  onTimeChange,
  onTzChange,
  onCsvLoad,
  onBack,
  onComplete,
  loading,
}: {
  sendWindowDay: string;
  sendWindowTime: string;
  sendWindowTz: string;
  csvFilename: string | null;
  onDayChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  onTzChange: (v: string) => void;
  onCsvLoad: (filename: string, data: string) => void;
  onBack: () => void;
  onComplete: () => void;
  loading: boolean;
}) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onCsvLoad(file.name, String(reader.result ?? ""));
    };
    reader.readAsText(file);
  };

  return (
    <div data-wizard-step="newsletter-preferences" className="space-y-6">
      <div className="space-y-2">
        <h3 className="font-heading text-lg">Newsletter</h3>
        <p className="text-sm text-muted-foreground">
          When should your newsletter land? Pick a day and time. If you have an
          existing email list, you can import it here too.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="send-day">
            Send day
          </label>
          <select
            id="send-day"
            value={sendWindowDay}
            onChange={(e) => onDayChange(e.target.value)}
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm"
            data-wizard-send-day
          >
            {SEND_WINDOW_DAYS.map((day) => (
              <option key={day} value={day}>
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="send-time">
            Send time
          </label>
          <Input
            id="send-time"
            type="time"
            value={sendWindowTime}
            onChange={(e) => onTimeChange(e.target.value)}
            data-wizard-send-time
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="send-tz">
            Timezone
          </label>
          <Input
            id="send-tz"
            value={sendWindowTz}
            onChange={(e) => onTzChange(e.target.value)}
            placeholder="Australia/Melbourne"
            data-wizard-send-tz
          />
        </div>
      </div>

      <div className="space-y-2 rounded-md border bg-muted/20 p-4">
        <h4 className="text-sm font-medium">
          Import existing list{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </h4>
        <p className="text-xs text-muted-foreground">
          CSV with email and name columns. Imported contacts will receive a
          permission pass email before joining your active list.
        </p>
        {csvFilename ? (
          <p className="text-sm text-muted-foreground">
            Loaded <code>{csvFilename}</code>
          </p>
        ) : (
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            data-wizard-csv-import
          />
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onComplete} disabled={loading}>
          {loading ? "Setting up…" : "Start my engine"}
        </Button>
      </div>
    </div>
  );
}
