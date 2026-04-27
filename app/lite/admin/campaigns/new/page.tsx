"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImageIcon,
  Loader2,
  Sparkles,
  Target,
  DollarSign,
  BrainCircuit,
  Eye,
  Rocket,
  Megaphone,
  Upload,
  Users,
  MousePointerClick,
  Heart,
  UserCheck,
  ShoppingCart,
} from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import type {
  CampaignObjective,
  FunnelStage,
} from "@/lib/db/schema/meta-campaigns";
import type { CampaignStrategy, StrategyInput } from "@/lib/meta-campaigns/build-strategy";
import {
  buildStrategyAction,
  listAdAccountsAction,
  createAdAccountAction,
  createCampaignFromStrategyAction,
  seedBenchmarksAction,
  listStudioPostsAction,
  generateAdCopyAction,
  type StudioPostSummary,
  type CreativePayload,
} from "../actions";
import type { MetaAdAccountRow } from "@/lib/db/schema/meta-campaigns";
import { useEffect } from "react";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const STEPS = [
  { id: "account", label: "Ad Account" },
  { id: "objective", label: "Objective" },
  { id: "budget", label: "Budget & Timeline" },
  { id: "creative", label: "Creative" },
  { id: "strategy", label: "AI Strategy" },
  { id: "review", label: "Review" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const OBJECTIVES: {
  id: CampaignObjective;
  label: string;
  desc: string;
  icon: typeof Megaphone;
}[] = [
  {
    id: "awareness",
    label: "Brand Awareness",
    desc: "Get your brand in front of new people",
    icon: Megaphone,
  },
  {
    id: "traffic",
    label: "Traffic",
    desc: "Drive clicks to your website or landing page",
    icon: MousePointerClick,
  },
  {
    id: "engagement",
    label: "Engagement",
    desc: "Get likes, comments, shares and saves",
    icon: Heart,
  },
  {
    id: "leads",
    label: "Lead Generation",
    desc: "Collect enquiries and contact details",
    icon: UserCheck,
  },
  {
    id: "conversions",
    label: "Conversions",
    desc: "Drive purchases, sign-ups, or bookings",
    icon: ShoppingCart,
  },
];

interface CreativeAsset {
  id: string;
  source: "content_studio" | "upload";
  studioPostId?: string;
  label: string;
  thumbnailUrl: string | null;
  cloudinaryUrl: string | null;
  cloudinaryPublicId: string | null;
  creativeType: "image" | "video" | "carousel";
  headline: string;
  primaryText: string;
  cta: string;
  uploading?: boolean;
}

const CTA_OPTIONS = [
  { id: "LEARN_MORE", label: "Learn More" },
  { id: "SHOP_NOW", label: "Shop Now" },
  { id: "SIGN_UP", label: "Sign Up" },
  { id: "BOOK_NOW", label: "Book Now" },
  { id: "CONTACT_US", label: "Contact Us" },
  { id: "GET_QUOTE", label: "Get Quote" },
  { id: "SEND_MESSAGE", label: "Send Message" },
  { id: "NO_BUTTON", label: "No button" },
] as const;

const BUDGET_PRESETS = [
  { label: "$300/mo", cents: 30000 },
  { label: "$500/mo", cents: 50000 },
  { label: "$1,000/mo", cents: 100000 },
  { label: "$2,000/mo", cents: 200000 },
  { label: "$5,000/mo", cents: 500000 },
  { label: "$10,000/mo", cents: 1000000 },
] as const;

const DURATION_PRESETS = [
  { label: "2 weeks", days: 14 },
  { label: "30 days", days: 30 },
  { label: "60 days", days: 60 },
  { label: "90 days", days: 90 },
  { label: "Ongoing", days: 365 },
] as const;

/* ------------------------------------------------------------------ */
/* Wizard                                                              */
/* ------------------------------------------------------------------ */

export default function NewCampaignWizard() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<StepId>("account");

  // Step 0 — Ad account
  const [accounts, setAccounts] = useState<MetaAdAccountRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountMetaId, setNewAccountMetaId] = useState("");

  // Step 1 — Objective
  const [objective, setObjective] = useState<CampaignObjective | null>(null);

  // Step 2 — Budget
  const [monthlyBudgetCents, setMonthlyBudgetCents] = useState<number>(100000);
  const [customBudget, setCustomBudget] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [location, setLocation] = useState("Australia");

  // Step 3 — Creative
  const [campaignLabel, setCampaignLabel] = useState("");
  const [studioPosts, setStudioPosts] = useState<StudioPostSummary[]>([]);
  const [creatives, setCreatives] = useState<CreativeAsset[]>([]);

  // Step 4 — Strategy
  const [strategyNotes, setStrategyNotes] = useState("");
  const [strategy, setStrategy] = useState<CampaignStrategy | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    listAdAccountsAction().then((res) => {
      if (res.ok) {
        setAccounts(res.accounts);
        if (res.accounts.length === 1) {
          setSelectedAccountId(res.accounts[0].id);
        }
      }
    });
    listStudioPostsAction().then((res) => {
      if (res.ok) setStudioPosts(res.posts);
    });
  }, []);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  function canAdvance(): boolean {
    switch (step) {
      case "account":
        return !!selectedAccountId;
      case "objective":
        return !!objective;
      case "budget":
        return monthlyBudgetCents > 0 && durationDays > 0;
      case "creative":
        return campaignLabel.trim().length > 0 && creatives.length > 0;
      case "strategy":
        return !!strategy;
      case "review":
        return !!strategy;
      default:
        return false;
    }
  }

  function goNext() {
    const idx = STEPS.findIndex((s) => s.id === step);
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1].id);
    }
  }

  function goBack() {
    const idx = STEPS.findIndex((s) => s.id === step);
    if (idx > 0) {
      setStep(STEPS[idx - 1].id);
    }
  }

  async function handleCreateAccount() {
    if (!newAccountName.trim() || !newAccountMetaId.trim()) {
      toast.error("Name and Meta Account ID are both required.");
      return;
    }
    const res = await createAdAccountAction({
      name: newAccountName,
      metaAccountId: newAccountMetaId,
    });
    if (res.ok) {
      setSelectedAccountId(res.id);
      setAccounts((prev) => [
        ...prev,
        {
          id: res.id,
          meta_account_id: newAccountMetaId,
          name: newAccountName,
          currency: "AUD",
          timezone: "Australia/Melbourne",
          status: "active" as const,
          access_token_encrypted: null,
          pixel_id: null,
          pixel_installed: false,
          created_at_ms: Date.now(),
          updated_at_ms: Date.now(),
        },
      ]);
      setShowNewAccount(false);
      setNewAccountName("");
      setNewAccountMetaId("");
      toast.success("Ad account added.");
    }
  }

  async function handleGenerateStrategy() {
    if (!objective) return;
    setGenerating(true);

    await seedBenchmarksAction();

    const poolTag = campaignLabel.trim().toLowerCase().replace(/\s+/g, "-");
    const input: StrategyInput = {
      objective,
      monthlyBudgetCents,
      durationDays,
      contentPoolTag: poolTag,
      creativeCount: creatives.length,
      destinationUrl: destinationUrl.trim() || undefined,
      strategyNotes: strategyNotes.trim() || undefined,
      location: location.trim() || undefined,
    };

    const res = await buildStrategyAction(input);
    if (res.ok) {
      setStrategy(res.strategy);
      toast.success("Strategy ready.");
    } else {
      toast.error("Strategy generation failed — try again.");
    }
    setGenerating(false);
  }

  async function handleLaunch() {
    if (!strategy || !objective || !selectedAccountId) return;
    startTransition(async () => {
      const poolTag = campaignLabel.trim().toLowerCase().replace(/\s+/g, "-");
      const creativePayloads: CreativePayload[] = creatives.map((c) => ({
        source: c.source,
        studioPostId: c.studioPostId,
        label: c.label,
        cloudinaryUrl: c.cloudinaryUrl,
        cloudinaryPublicId: c.cloudinaryPublicId,
        creativeType: c.creativeType,
        headline: c.headline,
        primaryText: c.primaryText,
        cta: c.cta,
      }));
      const res = await createCampaignFromStrategyAction({
        adAccountId: selectedAccountId,
        strategy,
        strategyInput: {
          objective,
          monthlyBudgetCents,
          durationDays,
          contentPoolTag: poolTag,
          creativeCount: creatives.length,
          destinationUrl: destinationUrl.trim() || undefined,
          strategyNotes: strategyNotes.trim() || undefined,
          location: location.trim() || undefined,
        },
        creatives: creativePayloads,
        destinationUrl: destinationUrl.trim() || undefined,
      });
      if (res.ok) {
        toast.success(`${res.campaignIds.length} campaign(s) created as drafts.`);
        router.push("/lite/admin/campaigns");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push("/lite/admin/campaigns")}
          className="flex items-center gap-1.5 text-[color:var(--color-neutral-500)] text-[length:var(--text-small)] mb-4 hover:text-[color:var(--color-neutral-300)] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Campaigns
        </button>
        <h1 className="font-[family-name:var(--font-righteous)] text-[length:var(--text-display)] text-[color:var(--color-neutral-100)]">
          New Campaign
        </h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-10">
        {STEPS.map((s, i) => {
          const isCurrent = s.id === step;
          const isDone = i < stepIndex;
          return (
            <div key={s.id} className="flex items-center gap-1 flex-1">
              <button
                onClick={() => {
                  if (isDone) setStep(s.id);
                }}
                disabled={!isDone && !isCurrent}
                className="flex items-center gap-2 min-w-0"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[length:var(--text-micro)] font-medium transition-colors"
                  style={{
                    background: isCurrent
                      ? "var(--color-accent-cta)"
                      : isDone
                        ? "#7BAE7E"
                        : "var(--color-surface-3)",
                    color: isCurrent || isDone
                      ? "white"
                      : "var(--color-neutral-500)",
                  }}
                >
                  {isDone ? <Check size={14} /> : i + 1}
                </span>
                <span
                  className="hidden sm:block text-[length:var(--text-small)] truncate"
                  style={{
                    color: isCurrent
                      ? "var(--color-neutral-100)"
                      : "var(--color-neutral-500)",
                  }}
                >
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mx-1"
                  style={{
                    background: isDone
                      ? "#7BAE7E"
                      : "var(--color-neutral-700)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={houseSpring}
        >
          {step === "account" && (
            <StepAccount
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              onSelect={setSelectedAccountId}
              showNewAccount={showNewAccount}
              setShowNewAccount={setShowNewAccount}
              newAccountName={newAccountName}
              setNewAccountName={setNewAccountName}
              newAccountMetaId={newAccountMetaId}
              setNewAccountMetaId={setNewAccountMetaId}
              onCreateAccount={handleCreateAccount}
            />
          )}
          {step === "objective" && (
            <StepObjective
              objective={objective}
              onSelect={setObjective}
            />
          )}
          {step === "budget" && (
            <StepBudget
              monthlyBudgetCents={monthlyBudgetCents}
              setMonthlyBudgetCents={setMonthlyBudgetCents}
              customBudget={customBudget}
              setCustomBudget={setCustomBudget}
              durationDays={durationDays}
              setDurationDays={setDurationDays}
              destinationUrl={destinationUrl}
              setDestinationUrl={setDestinationUrl}
              location={location}
              setLocation={setLocation}
            />
          )}
          {step === "creative" && (
            <StepCreative
              campaignLabel={campaignLabel}
              setCampaignLabel={setCampaignLabel}
              studioPosts={studioPosts}
              creatives={creatives}
              setCreatives={setCreatives}
              objective={objective ?? "awareness"}
              destinationUrl={destinationUrl}
            />
          )}
          {step === "strategy" && (
            <StepStrategy
              strategyNotes={strategyNotes}
              setStrategyNotes={setStrategyNotes}
              strategy={strategy}
              generating={generating}
              onGenerate={handleGenerateStrategy}
            />
          )}
          {step === "review" && strategy && (
            <StepReview
              strategy={strategy}
              objective={objective!}
              monthlyBudgetCents={monthlyBudgetCents}
              durationDays={durationDays}
              campaignLabel={campaignLabel}
              creatives={creatives}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-10 pt-6 border-t border-[color:var(--color-neutral-800)]">
        <button
          onClick={goBack}
          disabled={stepIndex === 0}
          className="flex items-center gap-1.5 text-[color:var(--color-neutral-400)] text-[length:var(--text-body)] hover:text-[color:var(--color-neutral-200)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {step === "review" ? (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={houseSpring}
            onClick={handleLaunch}
            disabled={isPending || !strategy}
            className="flex items-center gap-2 rounded-md bg-[color:var(--color-accent-cta)] px-5 py-2.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] font-medium text-white shadow-sm disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Rocket size={16} />
            )}
            Create Campaigns
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={houseSpring}
            onClick={goNext}
            disabled={!canAdvance()}
            className="flex items-center gap-1.5 rounded-md bg-[color:var(--color-accent-cta)] px-4 py-2.5 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] font-medium text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
            <ArrowRight size={16} />
          </motion.button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step components                                                     */
/* ------------------------------------------------------------------ */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-[family-name:var(--font-righteous)] text-[length:var(--text-heading)] text-[color:var(--color-neutral-100)] mb-2">
      {children}
    </h2>
  );
}

function SectionHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[color:var(--color-neutral-400)] text-[length:var(--text-body)] mb-6">
      {children}
    </p>
  );
}

/* -- Step: Ad Account -- */

function StepAccount({
  accounts,
  selectedAccountId,
  onSelect,
  showNewAccount,
  setShowNewAccount,
  newAccountName,
  setNewAccountName,
  newAccountMetaId,
  setNewAccountMetaId,
  onCreateAccount,
}: {
  accounts: MetaAdAccountRow[];
  selectedAccountId: string | null;
  onSelect: (id: string) => void;
  showNewAccount: boolean;
  setShowNewAccount: (v: boolean) => void;
  newAccountName: string;
  setNewAccountName: (v: string) => void;
  newAccountMetaId: string;
  setNewAccountMetaId: (v: string) => void;
  onCreateAccount: () => void;
}) {
  return (
    <div>
      <SectionHeading>Which ad account?</SectionHeading>
      <SectionHint>
        Select the Meta ad account this campaign will run under.
      </SectionHint>

      {accounts.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {accounts.map((a) => (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              className="flex items-center gap-3 rounded-lg p-4 text-left transition-colors"
              style={{
                background:
                  selectedAccountId === a.id
                    ? "var(--color-surface-3)"
                    : "var(--color-surface-2)",
                border:
                  selectedAccountId === a.id
                    ? "1px solid var(--color-accent-cta)"
                    : "1px solid transparent",
              }}
            >
              <Target
                size={20}
                className={
                  selectedAccountId === a.id
                    ? "text-[color:var(--color-accent-cta)]"
                    : "text-[color:var(--color-neutral-500)]"
                }
              />
              <div>
                <span className="block text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] font-medium">
                  {a.name}
                </span>
                <span className="block text-[color:var(--color-neutral-500)] text-[length:var(--text-small)]">
                  {a.meta_account_id} · {a.currency}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!showNewAccount ? (
        <button
          onClick={() => setShowNewAccount(true)}
          className="text-[color:var(--color-accent-cta)] text-[length:var(--text-body)] hover:underline"
        >
          + Add a new ad account
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={houseSpring}
          className="rounded-lg bg-[color:var(--color-surface-2)] p-4 flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1">
            <span className="text-[color:var(--color-neutral-400)] text-[length:var(--text-small)]">
              Account name
            </span>
            <input
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="e.g. SuperBad Marketing"
              className="rounded-md bg-[color:var(--color-surface-1)] border border-[color:var(--color-neutral-700)] px-3 py-2 text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] outline-none focus:border-[color:var(--color-accent-cta)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[color:var(--color-neutral-400)] text-[length:var(--text-small)]">
              Meta Account ID
            </span>
            <input
              value={newAccountMetaId}
              onChange={(e) => setNewAccountMetaId(e.target.value)}
              placeholder="e.g. act_123456789"
              className="rounded-md bg-[color:var(--color-surface-1)] border border-[color:var(--color-neutral-700)] px-3 py-2 text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] outline-none focus:border-[color:var(--color-accent-cta)]"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={onCreateAccount}
              className="rounded-md bg-[color:var(--color-accent-cta)] px-3 py-1.5 text-[length:var(--text-small)] font-medium text-white"
            >
              Add Account
            </button>
            <button
              onClick={() => setShowNewAccount(false)}
              className="text-[color:var(--color-neutral-500)] text-[length:var(--text-small)] hover:text-[color:var(--color-neutral-300)]"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* -- Step: Objective -- */

function StepObjective({
  objective,
  onSelect,
}: {
  objective: CampaignObjective | null;
  onSelect: (o: CampaignObjective) => void;
}) {
  return (
    <div>
      <SectionHeading>What's the goal?</SectionHeading>
      <SectionHint>
        This shapes the entire campaign — funnel structure, audiences, bidding, and what "success" means.
      </SectionHint>

      <div className="flex flex-col gap-2">
        {OBJECTIVES.map((o) => {
          const Icon = o.icon;
          const isSelected = objective === o.id;
          return (
            <motion.button
              key={o.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              transition={houseSpring}
              onClick={() => onSelect(o.id)}
              className="flex items-center gap-4 rounded-lg p-4 text-left transition-colors"
              style={{
                background: isSelected
                  ? "var(--color-surface-3)"
                  : "var(--color-surface-2)",
                border: isSelected
                  ? "1px solid var(--color-accent-cta)"
                  : "1px solid transparent",
              }}
            >
              <Icon
                size={24}
                strokeWidth={1.5}
                className={
                  isSelected
                    ? "text-[color:var(--color-accent-cta)]"
                    : "text-[color:var(--color-neutral-500)]"
                }
              />
              <div>
                <span className="block text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] font-medium">
                  {o.label}
                </span>
                <span className="block text-[color:var(--color-neutral-500)] text-[length:var(--text-small)]">
                  {o.desc}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* -- Step: Budget -- */

function StepBudget({
  monthlyBudgetCents,
  setMonthlyBudgetCents,
  customBudget,
  setCustomBudget,
  durationDays,
  setDurationDays,
  destinationUrl,
  setDestinationUrl,
  location,
  setLocation,
}: {
  monthlyBudgetCents: number;
  setMonthlyBudgetCents: (v: number) => void;
  customBudget: string;
  setCustomBudget: (v: string) => void;
  durationDays: number;
  setDurationDays: (v: number) => void;
  destinationUrl: string;
  setDestinationUrl: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
}) {
  const dailyBudget = monthlyBudgetCents / 100 / 30;

  return (
    <div>
      <SectionHeading>Budget & timeline</SectionHeading>
      <SectionHint>
        How much and how long. The AI strategist will optimise around your budget.
      </SectionHint>

      <div className="mb-6">
        <label className="block text-[color:var(--color-neutral-300)] text-[length:var(--text-body)] font-medium mb-3">
          Monthly budget
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {BUDGET_PRESETS.map((p) => (
            <button
              key={p.cents}
              onClick={() => {
                setMonthlyBudgetCents(p.cents);
                setCustomBudget("");
              }}
              className="rounded-md px-3 py-2 text-[length:var(--text-body)] transition-colors"
              style={{
                background:
                  monthlyBudgetCents === p.cents && !customBudget
                    ? "var(--color-accent-cta)"
                    : "var(--color-surface-2)",
                color:
                  monthlyBudgetCents === p.cents && !customBudget
                    ? "white"
                    : "var(--color-neutral-300)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[color:var(--color-neutral-500)]">$</span>
          <input
            type="number"
            value={customBudget}
            onChange={(e) => {
              setCustomBudget(e.target.value);
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) {
                setMonthlyBudgetCents(Math.round(v * 100));
              }
            }}
            placeholder="Custom amount"
            className="w-40 rounded-md bg-[color:var(--color-surface-2)] border border-[color:var(--color-neutral-700)] px-3 py-2 text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] outline-none focus:border-[color:var(--color-accent-cta)]"
          />
          <span className="text-[color:var(--color-neutral-500)] text-[length:var(--text-small)]">
            AUD/month
          </span>
        </div>
        <p className="mt-2 text-[color:var(--color-neutral-500)] text-[length:var(--text-small)]">
          ≈ ${dailyBudget.toFixed(2)} AUD/day
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-[color:var(--color-neutral-300)] text-[length:var(--text-body)] font-medium mb-3">
          Duration
        </label>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((d) => (
            <button
              key={d.days}
              onClick={() => setDurationDays(d.days)}
              className="rounded-md px-3 py-2 text-[length:var(--text-body)] transition-colors"
              style={{
                background:
                  durationDays === d.days
                    ? "var(--color-accent-cta)"
                    : "var(--color-surface-2)",
                color:
                  durationDays === d.days
                    ? "white"
                    : "var(--color-neutral-300)",
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="flex flex-col gap-1">
          <span className="text-[color:var(--color-neutral-300)] text-[length:var(--text-body)] font-medium">
            Destination URL
          </span>
          <span className="text-[color:var(--color-neutral-500)] text-[length:var(--text-small)]">
            Where clicks go. Leave blank for engagement-only campaigns.
          </span>
          <input
            value={destinationUrl}
            onChange={(e) => setDestinationUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1 rounded-md bg-[color:var(--color-surface-2)] border border-[color:var(--color-neutral-700)] px-3 py-2 text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] outline-none focus:border-[color:var(--color-accent-cta)]"
          />
        </label>
      </div>

      <div>
        <label className="flex flex-col gap-1">
          <span className="text-[color:var(--color-neutral-300)] text-[length:var(--text-body)] font-medium">
            Location targeting
          </span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Australia"
            className="mt-1 w-64 rounded-md bg-[color:var(--color-surface-2)] border border-[color:var(--color-neutral-700)] px-3 py-2 text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] outline-none focus:border-[color:var(--color-accent-cta)]"
          />
        </label>
      </div>
    </div>
  );
}

/* -- Step: Creative -- */

function StepCreative({
  campaignLabel,
  setCampaignLabel,
  studioPosts,
  creatives,
  setCreatives,
  objective,
  destinationUrl,
}: {
  campaignLabel: string;
  setCampaignLabel: (v: string) => void;
  studioPosts: StudioPostSummary[];
  creatives: CreativeAsset[];
  setCreatives: (v: CreativeAsset[]) => void;
  objective: string;
  destinationUrl: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  function addFromStudio(post: StudioPostSummary) {
    if (creatives.some((c) => c.studioPostId === post.id)) return;
    const newId = crypto.randomUUID();
    setCreatives([
      ...creatives,
      {
        id: newId,
        source: "content_studio",
        studioPostId: post.id,
        label: post.brief.slice(0, 60),
        thumbnailUrl: post.thumbnailUrl,
        cloudinaryUrl: post.thumbnailUrl,
        cloudinaryPublicId: null,
        creativeType: "image",
        headline: "",
        primaryText: "",
        cta: "LEARN_MORE",
      },
    ]);
    setEditingId(newId);
  }

  function addBlankUpload() {
    const newId = crypto.randomUUID();
    setCreatives([
      ...creatives,
      {
        id: newId,
        source: "upload",
        label: `Creative ${creatives.length + 1}`,
        thumbnailUrl: null,
        cloudinaryUrl: null,
        cloudinaryPublicId: null,
        creativeType: "image",
        headline: "",
        primaryText: "",
        cta: "LEARN_MORE",
      },
    ]);
    setEditingId(newId);
  }

  function removeCreative(id: string) {
    setCreatives(creatives.filter((c) => c.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function updateCreative(id: string, patch: Partial<CreativeAsset>) {
    setCreatives(
      creatives.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  async function handleGenerateCopy(creative: CreativeAsset) {
    setGeneratingId(creative.id);
    try {
      const res = await generateAdCopyAction({
        objective,
        creativeType: creative.creativeType,
        campaignLabel,
        destinationUrl: destinationUrl.trim() || undefined,
      });
      if (res.ok) {
        updateCreative(creative.id, {
          headline: res.headline,
          primaryText: res.primaryText,
        });
        toast.success("Copy generated.");
      }
    } catch {
      toast.error("Copy generation failed — try again.");
    }
    setGeneratingId(null);
  }

  async function handleFileSelect(creativeId: string, file: File) {
    const localPreview = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/");
    updateCreative(creativeId, {
      thumbnailUrl: localPreview,
      creativeType: isVideo ? "video" : "image",
      label: file.name.replace(/\.[^.]+$/, "").slice(0, 60),
      uploading: true,
    });

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload/campaign-creative", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.ok) {
        updateCreative(creativeId, {
          cloudinaryUrl: data.url,
          cloudinaryPublicId: data.publicId,
          thumbnailUrl: data.url,
          uploading: false,
        });
        toast.success("Creative uploaded.");
      } else {
        toast.error(data.error ?? "Upload failed.");
        updateCreative(creativeId, { uploading: false });
      }
    } catch {
      toast.error("Upload failed — check your connection.");
      updateCreative(creativeId, { uploading: false });
    }
  }

  const CONTENT_TYPE_LABELS: Record<string, string> = {
    announcement: "Announcement",
    anti_motivation: "Anti-Motivation",
    portfolio: "Portfolio",
    tips: "Tips & Value",
    testimonial: "Testimonial",
    behind_the_scenes: "BTS",
  };

  return (
    <div>
      <SectionHeading>Creative & copy</SectionHeading>
      <SectionHint>
        Name your campaign, pick your content, and write the ad copy. The AI
        strategist will figure out how to test and distribute them.
      </SectionHint>

      {/* Campaign label */}
      <div className="mb-8">
        <label className="flex flex-col gap-1">
          <span className="text-[color:var(--color-neutral-300)] text-[length:var(--text-body)] font-medium">
            Campaign name
          </span>
          <span className="text-[color:var(--color-neutral-500)] text-[length:var(--text-small)]">
            A name for this campaign. This also keeps audiences scoped —
            people who engage with other clients' content won't bleed into
            this campaign's retargeting.
          </span>
          <input
            value={campaignLabel}
            onChange={(e) => setCampaignLabel(e.target.value)}
            placeholder="e.g. SuperBad Brand Push, Thetford Pilot"
            className="mt-1 rounded-md bg-[color:var(--color-surface-2)] border border-[color:var(--color-neutral-700)] px-3 py-2 text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] outline-none focus:border-[color:var(--color-accent-cta)]"
          />
        </label>
      </div>

      {/* Content Studio picker */}
      {studioPosts.length > 0 && (
        <div className="mb-6">
          <span className="block text-[color:var(--color-neutral-300)] text-[length:var(--text-body)] font-medium mb-3">
            Pick from Content Studio
          </span>
          <div className="flex flex-wrap gap-2">
            {studioPosts.map((post) => {
              const alreadyAdded = creatives.some(
                (c) => c.studioPostId === post.id,
              );
              return (
                <button
                  key={post.id}
                  onClick={() => addFromStudio(post)}
                  disabled={alreadyAdded}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-left transition-colors"
                  style={{
                    background: alreadyAdded
                      ? "var(--color-surface-3)"
                      : "var(--color-surface-2)",
                    opacity: alreadyAdded ? 0.5 : 1,
                  }}
                >
                  {post.thumbnailUrl ? (
                    <img
                      src={post.thumbnailUrl}
                      alt=""
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded bg-[color:var(--color-surface-1)] text-[color:var(--color-neutral-600)] text-[length:var(--text-micro)]">
                      {post.content_type.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="flex flex-col min-w-0">
                    <span className="text-[color:var(--color-neutral-200)] text-[length:var(--text-small)] truncate max-w-[160px]">
                      {post.brief.slice(0, 40)}
                    </span>
                    <span className="text-[color:var(--color-neutral-500)] text-[length:var(--text-micro)]">
                      {CONTENT_TYPE_LABELS[post.content_type] ?? post.content_type}
                      {alreadyAdded ? " · Added" : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add upload */}
      <div className="mb-6">
        <button
          onClick={addBlankUpload}
          className="text-[color:var(--color-accent-cta)] text-[length:var(--text-body)] hover:underline"
        >
          + Add a creative
        </button>
      </div>

      {/* Creative cards */}
      {creatives.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-[color:var(--color-neutral-300)] text-[length:var(--text-body)] font-medium">
            Your creatives ({creatives.length})
          </span>
          {creatives.map((c) => {
            const isEditing = editingId === c.id;
            const isGenerating = generatingId === c.id;
            return (
              <div
                key={c.id}
                className="rounded-lg bg-[color:var(--color-surface-2)] p-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  {c.thumbnailUrl ? (
                    <img
                      src={c.thumbnailUrl}
                      alt=""
                      className="h-10 w-10 rounded object-cover shrink-0"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded bg-[color:var(--color-surface-1)] text-[color:var(--color-neutral-600)] text-[length:var(--text-small)] shrink-0">
                      {c.source === "upload" ? <Upload size={16} /> : "CS"}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="block text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] font-medium truncate">
                      {c.label}
                    </span>
                    <span className="text-[color:var(--color-neutral-500)] text-[length:var(--text-small)]">
                      {c.source === "content_studio" ? "Content Studio" : "Upload"} ·{" "}
                      {c.uploading ? "Uploading..." : c.headline ? "Copy written" : "Needs copy"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setEditingId(isEditing ? null : c.id)}
                      className="text-[color:var(--color-accent-cta)] text-[length:var(--text-small)] hover:underline"
                    >
                      {isEditing ? "Done" : "Edit"}
                    </button>
                    <button
                      onClick={() => removeCreative(c.id)}
                      className="text-[color:var(--color-neutral-500)] text-[length:var(--text-small)] hover:text-[color:var(--color-accent-cta)]"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={houseSpring}
                    className="flex flex-col gap-3 pt-3 border-t border-[color:var(--color-neutral-700)]"
                  >
                    {/* Upload area */}
                    <div>
                      <span className="block text-[color:var(--color-neutral-400)] text-[length:var(--text-small)] mb-1">
                        Visual creative
                      </span>
                      {c.thumbnailUrl ? (
                        <div className="relative group w-fit">
                          <img
                            src={c.thumbnailUrl}
                            alt=""
                            className="h-32 w-auto rounded-md object-cover"
                          />
                          {c.uploading && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/60">
                              <Loader2 size={24} className="animate-spin text-white" />
                            </div>
                          )}
                          {!c.uploading && (
                            <label className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                              <span className="text-white text-[length:var(--text-small)] font-medium">Replace</span>
                              <input
                                type="file"
                                accept="image/*,video/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileSelect(c.id, file);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[color:var(--color-neutral-600)] bg-[color:var(--color-surface-1)] p-6 cursor-pointer hover:border-[color:var(--color-accent-cta)] transition-colors">
                          <ImageIcon size={24} className="text-[color:var(--color-neutral-500)]" />
                          <span className="text-[color:var(--color-neutral-400)] text-[length:var(--text-small)]">
                            Drop an image or video here, or click to browse
                          </span>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(c.id, file);
                            }}
                          />
                        </label>
                      )}
                    </div>

                    {/* Copy fields + generate button */}
                    <div className="flex items-center justify-between">
                      <span className="text-[color:var(--color-neutral-300)] text-[length:var(--text-small)] font-medium">
                        Ad copy
                      </span>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        transition={houseSpring}
                        onClick={() => handleGenerateCopy(c)}
                        disabled={isGenerating || !campaignLabel.trim()}
                        className="flex items-center gap-1.5 rounded-md bg-[color:var(--color-surface-3)] px-2.5 py-1.5 text-[length:var(--text-small)] font-medium text-[color:var(--color-neutral-200)] hover:bg-[color:var(--color-surface-1)] transition-colors disabled:opacity-40"
                      >
                        {isGenerating ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Sparkles size={14} className="text-[color:var(--color-brand-pink)]" />
                        )}
                        {isGenerating ? "Generating..." : "Generate copy"}
                      </motion.button>
                    </div>

                    <label className="flex flex-col gap-1">
                      <span className="text-[color:var(--color-neutral-400)] text-[length:var(--text-small)]">
                        Headline
                      </span>
                      <input
                        value={c.headline}
                        onChange={(e) =>
                          updateCreative(c.id, { headline: e.target.value })
                        }
                        placeholder="Short, punchy headline"
                        className="rounded-md bg-[color:var(--color-surface-1)] border border-[color:var(--color-neutral-700)] px-3 py-2 text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] outline-none focus:border-[color:var(--color-accent-cta)]"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[color:var(--color-neutral-400)] text-[length:var(--text-small)]">
                        Primary text
                      </span>
                      <textarea
                        value={c.primaryText}
                        onChange={(e) =>
                          updateCreative(c.id, { primaryText: e.target.value })
                        }
                        placeholder="The main ad copy that appears above the creative"
                        rows={3}
                        className="rounded-md bg-[color:var(--color-surface-1)] border border-[color:var(--color-neutral-700)] px-3 py-2 text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] outline-none focus:border-[color:var(--color-accent-cta)] resize-none"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[color:var(--color-neutral-400)] text-[length:var(--text-small)]">
                        Call to action
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {CTA_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() =>
                              updateCreative(c.id, { cta: opt.id })
                            }
                            className="rounded-md px-2.5 py-1 text-[length:var(--text-small)] transition-colors"
                            style={{
                              background:
                                c.cta === opt.id
                                  ? "var(--color-accent-cta)"
                                  : "var(--color-surface-1)",
                              color:
                                c.cta === opt.id
                                  ? "white"
                                  : "var(--color-neutral-400)",
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[color:var(--color-neutral-400)] text-[length:var(--text-small)]">
                        Creative type
                      </span>
                      <div className="flex gap-2">
                        {(["image", "video", "carousel"] as const).map(
                          (type) => (
                            <button
                              key={type}
                              onClick={() =>
                                updateCreative(c.id, { creativeType: type })
                              }
                              className="rounded-md px-3 py-1.5 text-[length:var(--text-small)] capitalize transition-colors"
                              style={{
                                background:
                                  c.creativeType === type
                                    ? "var(--color-accent-cta)"
                                    : "var(--color-surface-1)",
                                color:
                                  c.creativeType === type
                                    ? "white"
                                    : "var(--color-neutral-400)",
                              }}
                            >
                              {type}
                            </button>
                          ),
                        )}
                      </div>
                    </label>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {creatives.length > 0 && (
        <p className="mt-4 text-[color:var(--color-neutral-500)] text-[length:var(--text-small)]">
          The AI strategist will distribute these across ad sets and plan A/B
          testing automatically.
        </p>
      )}
    </div>
  );
}

/* -- Step: Strategy -- */

function StepStrategy({
  strategyNotes,
  setStrategyNotes,
  strategy,
  generating,
  onGenerate,
}: {
  strategyNotes: string;
  setStrategyNotes: (v: string) => void;
  strategy: CampaignStrategy | null;
  generating: boolean;
  onGenerate: () => void;
}) {
  return (
    <div>
      <SectionHeading>AI Strategy Builder</SectionHeading>
      <SectionHint>
        Got ideas on how the campaign should run? Drop them below. Otherwise, the AI strategist will figure out the best approach.
      </SectionHint>

      <div className="mb-6">
        <textarea
          value={strategyNotes}
          onChange={(e) => setStrategyNotes(e.target.value)}
          placeholder="Optional — e.g. 'Focus on Reels content, target 25-45 age range, avoid interest targeting'..."
          rows={4}
          className="w-full rounded-md bg-[color:var(--color-surface-2)] border border-[color:var(--color-neutral-700)] px-3 py-2 text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] outline-none focus:border-[color:var(--color-accent-cta)] resize-none"
        />
      </div>

      {!strategy && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={houseSpring}
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center gap-2 rounded-md bg-[color:var(--color-accent-cta)] px-5 py-3 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] font-medium text-white shadow-sm disabled:opacity-60"
        >
          {generating ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Building strategy...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Build Strategy
            </>
          )}
        </motion.button>
      )}

      {strategy && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={houseSpring}
          className="rounded-lg bg-[color:var(--color-surface-2)] p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <BrainCircuit size={20} className="text-[color:var(--color-accent-cta)]" />
            <span className="font-[family-name:var(--font-righteous)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)]">
              Strategy ready
            </span>
          </div>
          <p className="text-[color:var(--color-neutral-300)] text-[length:var(--text-body)] mb-4">
            {strategy.overview}
          </p>

          <div className="flex flex-col gap-3">
            {strategy.campaigns.map((c, i) => (
              <div
                key={i}
                className="rounded-md bg-[color:var(--color-surface-1)] p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] font-medium">
                    {c.name}
                  </span>
                  <span className="text-[color:var(--color-brand-pink)] text-[length:var(--text-small)]">
                    ${(c.dailyBudgetCents / 100).toFixed(2)}/day
                  </span>
                </div>
                <span className="text-[color:var(--color-neutral-500)] text-[length:var(--text-small)]">
                  {c.adSets.length} ad set{c.adSets.length !== 1 ? "s" : ""} ·{" "}
                  {c.funnelStage} of funnel
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={onGenerate}
              className="text-[color:var(--color-accent-cta)] text-[length:var(--text-small)] hover:underline"
            >
              Regenerate strategy
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* -- Step: Review -- */

function StepReview({
  strategy,
  objective,
  monthlyBudgetCents,
  durationDays,
  campaignLabel,
  creatives,
}: {
  strategy: CampaignStrategy;
  objective: CampaignObjective;
  monthlyBudgetCents: number;
  durationDays: number;
  campaignLabel: string;
  creatives: CreativeAsset[];
}) {
  const scaling = strategy.scalingRecommendation;

  return (
    <div>
      <SectionHeading>Review & launch</SectionHeading>
      <SectionHint>
        Everything looks right? Campaigns will be created as drafts — nothing goes live until you push to Meta.
      </SectionHint>

      <div className="flex flex-col gap-4">
        {/* Summary */}
        <div className="rounded-lg bg-[color:var(--color-surface-2)] p-4">
          <h3 className="text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] font-medium mb-3">
            Campaign Summary
          </h3>
          <div className="grid grid-cols-2 gap-y-2 gap-x-8 text-[length:var(--text-small)]">
            <span className="text-[color:var(--color-neutral-500)]">Campaign</span>
            <span className="text-[color:var(--color-neutral-200)]">{campaignLabel}</span>
            <span className="text-[color:var(--color-neutral-500)]">Objective</span>
            <span className="text-[color:var(--color-neutral-200)] capitalize">{objective}</span>
            <span className="text-[color:var(--color-neutral-500)]">Budget</span>
            <span className="text-[color:var(--color-neutral-200)]">
              ${(monthlyBudgetCents / 100).toFixed(2)}/month
            </span>
            <span className="text-[color:var(--color-neutral-500)]">Duration</span>
            <span className="text-[color:var(--color-neutral-200)]">{durationDays} days</span>
            <span className="text-[color:var(--color-neutral-500)]">Creatives</span>
            <span className="text-[color:var(--color-neutral-200)]">{creatives.length} assets</span>
            <span className="text-[color:var(--color-neutral-500)]">Campaigns</span>
            <span className="text-[color:var(--color-neutral-200)]">
              {strategy.campaigns.length}
            </span>
            <span className="text-[color:var(--color-neutral-500)]">Total ad sets</span>
            <span className="text-[color:var(--color-neutral-200)]">
              {strategy.campaigns.reduce((sum, c) => sum + c.adSets.length, 0)}
            </span>
          </div>
        </div>

        {/* Creatives summary */}
        <div className="rounded-lg bg-[color:var(--color-surface-2)] p-4">
          <h3 className="text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] font-medium mb-3">
            Creatives
          </h3>
          <div className="flex flex-col gap-2">
            {creatives.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                {c.thumbnailUrl ? (
                  <img
                    src={c.thumbnailUrl}
                    alt=""
                    className="h-8 w-8 rounded object-cover shrink-0"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded bg-[color:var(--color-surface-1)] text-[color:var(--color-neutral-600)] text-[length:var(--text-micro)] shrink-0">
                    {c.creativeType.slice(0, 3).toUpperCase()}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <span className="block text-[color:var(--color-neutral-200)] text-[length:var(--text-small)] truncate">
                    {c.headline || c.label}
                  </span>
                  <span className="text-[color:var(--color-neutral-500)] text-[length:var(--text-micro)]">
                    {c.creativeType} · {c.source === "content_studio" ? "Content Studio" : "Upload"} · {CTA_OPTIONS.find((o) => o.id === c.cta)?.label ?? c.cta}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Funnel */}
        <div className="rounded-lg bg-[color:var(--color-surface-2)] p-4">
          <h3 className="text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] font-medium mb-2">
            Funnel Structure
          </h3>
          <p className="text-[color:var(--color-neutral-400)] text-[length:var(--text-small)]">
            {strategy.funnelStructure}
          </p>
        </div>

        {/* Creative strategy */}
        <div className="rounded-lg bg-[color:var(--color-surface-2)] p-4">
          <h3 className="text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] font-medium mb-2">
            Creative Strategy
          </h3>
          <p className="text-[color:var(--color-neutral-400)] text-[length:var(--text-small)]">
            {strategy.creativeStrategy}
          </p>
        </div>

        {/* Scaling */}
        <div className="rounded-lg bg-[color:var(--color-surface-2)] p-4">
          <h3 className="text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] font-medium mb-3">
            Scaling & Guardrails
          </h3>
          <div className="grid grid-cols-2 gap-y-2 gap-x-8 text-[length:var(--text-small)]">
            <span className="text-[color:var(--color-neutral-500)]">Mode</span>
            <span className="text-[color:var(--color-neutral-200)] capitalize">
              {scaling.mode === "to_cap"
                ? "Scale to daily cap"
                : scaling.mode === "indefinite"
                  ? "Scale indefinitely"
                  : "No auto-scaling"}
            </span>
            <span className="text-[color:var(--color-neutral-500)]">Velocity</span>
            <span className="text-[color:var(--color-neutral-200)]">
              {scaling.velocityPct}%/day max
            </span>
            {scaling.roasFloor != null && (
              <>
                <span className="text-[color:var(--color-neutral-500)]">ROAS floor</span>
                <span className="text-[color:var(--color-neutral-200)]">{scaling.roasFloor}x</span>
              </>
            )}
            {scaling.dailyCapCents != null && (
              <>
                <span className="text-[color:var(--color-neutral-500)]">Daily cap</span>
                <span className="text-[color:var(--color-neutral-200)]">
                  ${(scaling.dailyCapCents / 100).toFixed(2)}
                </span>
              </>
            )}
            <span className="text-[color:var(--color-neutral-500)]">Human checkpoint</span>
            <span className="text-[color:var(--color-neutral-200)]">
              {scaling.humanCheckpoint
                ? `Yes — at $${((scaling.checkpointSpendCents ?? 0) / 100).toFixed(0)} spend`
                : "No"}
            </span>
          </div>
        </div>

        {/* Expectations */}
        <div className="rounded-lg bg-[color:var(--color-surface-2)] p-4">
          <h3 className="text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] font-medium mb-2">
            Expected Outcomes
          </h3>
          <p className="text-[color:var(--color-neutral-400)] text-[length:var(--text-small)]">
            {strategy.expectedOutcomes}
          </p>
        </div>

        {/* Risks */}
        <div className="rounded-lg bg-[color:var(--color-surface-2)] p-4">
          <h3 className="text-[color:var(--color-neutral-100)] text-[length:var(--text-body)] font-medium mb-2">
            Risks
          </h3>
          <p className="text-[color:var(--color-neutral-400)] text-[length:var(--text-small)]">
            {strategy.risks}
          </p>
        </div>
      </div>
    </div>
  );
}
