"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckIcon, ChevronRightIcon, LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brand, neutral, houseSpring } from "@/lib/design-tokens";
import { tier2 } from "@/lib/motion/choreographies";
import { useSound } from "@/components/lite/sound-provider";
import {
  saveAbnLegalNameAction,
  saveAgreementAction,
  saveBankDetailsAction,
  completeOnboardingAction,
} from "@/app/bench/onboard/actions";

interface Props {
  candidateId: string;
  candidateName: string;
  defaultRate: number | null;
  defaultCapacity: number | null;
}

const STEP_LABELS = [
  "ABN & legal name",
  "Agreement",
  "Bank details",
  "Confirm",
];

export function ContractorOnboardingFlow({
  candidateName,
  defaultRate,
  defaultCapacity,
}: Props) {
  const router = useRouter();
  const { play } = useSound();
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [abn, setAbn] = useState("");
  const [legalName, setLegalName] = useState(candidateName);
  const [bsb, setBsb] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [rate, setRate] = useState(defaultRate?.toString() ?? "");
  const [capacity, setCapacity] = useState(defaultCapacity?.toString() ?? "");

  function handleNext() {
    setError(null);
    startTransition(async () => {
      if (step === 0) {
        const result = await saveAbnLegalNameAction(abn, legalName);
        if (!result.ok) { setError(result.error); return; }
        setStep(1);
      } else if (step === 1) {
        const result = await saveAgreementAction();
        if (!result.ok) { setError(result.error); return; }
        setStep(2);
      } else if (step === 2) {
        const result = await saveBankDetailsAction(bsb, accountNumber, accountName);
        if (!result.ok) { setError(result.error); return; }
        setStep(3);
      } else if (step === 3) {
        const result = await completeOnboardingAction(
          Number(rate),
          Number(capacity),
        );
        if (!result.ok) { setError(result.error); return; }
        play("quote-accepted");
        setCompleted(true);
        setTimeout(() => {
          router.push("/bench");
          router.refresh();
        }, 1200);
      }
    });
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-surface-0)] p-6">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <span
            className="text-sm font-semibold tracking-tight"
            style={{ color: brand.orange }}
          >
            SuperBad
          </span>
          <h1
            className="mt-2 text-xl font-semibold tracking-tight"
            style={{ color: neutral[900] }}
          >
            Quick setup — ABN, agreement, bank details, and we&apos;re done.
          </h1>
        </div>

        {/* Progress */}
        <div className="mb-8 flex gap-1.5">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex-1">
              <motion.div
                className="h-1 rounded-full"
                style={{
                  backgroundColor: i <= step ? brand.orange : neutral[300],
                }}
                animate={{
                  backgroundColor: i <= step ? brand.orange : neutral[300],
                }}
                transition={houseSpring}
              />
              <p
                className="mt-1 text-[10px]"
                style={{ color: i === step ? neutral[700] : neutral[500] }}
              >
                {label}
              </p>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={houseSpring}
          >
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: neutral[700] }}>
                    ABN
                  </label>
                  <Input
                    value={abn}
                    onChange={(e) => setAbn(e.target.value)}
                    placeholder="11 digit ABN"
                    maxLength={14}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: neutral[700] }}>
                    Legal name
                  </label>
                  <Input
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="As registered with the ATO"
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div
                  className="rounded-xl border p-5"
                  style={{ borderColor: neutral[300] }}
                >
                  <h3 className="mb-2 text-sm font-medium" style={{ color: neutral[900] }}>
                    Contractor agreement
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: neutral[500] }}>
                    By proceeding, you confirm that you have read and agree to the
                    SuperBad contractor agreement. This covers scope of work,
                    payment terms, IP assignment, and confidentiality.
                  </p>
                </div>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-neutral-300"
                    id="agree"
                  />
                  <span className="text-sm" style={{ color: neutral[700] }}>
                    I have read and agree to the contractor agreement
                  </span>
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: neutral[700] }}>
                    BSB
                  </label>
                  <Input
                    value={bsb}
                    onChange={(e) => setBsb(e.target.value)}
                    placeholder="000-000"
                    maxLength={7}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: neutral[700] }}>
                    Account number
                  </label>
                  <Input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Account number"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: neutral[700] }}>
                    Account name
                  </label>
                  <Input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Name on the account"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: neutral[700] }}>
                    Hourly rate (AUD)
                  </label>
                  <Input
                    type="number"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="e.g. 80"
                    min={1}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: neutral[700] }}>
                    Weekly capacity (hours)
                  </label>
                  <Input
                    type="number"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="e.g. 20"
                    min={1}
                    max={168}
                  />
                </div>
                <div
                  className="mt-4 rounded-xl border p-4"
                  style={{ borderColor: neutral[300] }}
                >
                  <p className="text-xs" style={{ color: neutral[500] }}>
                    You can update your rate and availability any time from your
                    profile. Rate changes are subject to approval.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-sm"
            style={{ color: brand.red }}
          >
            {error}
          </motion.p>
        )}

        <div className="mt-8">
          {completed ? (
            <motion.div
              initial="initial"
              animate="animate"
              variants={tier2["wizard-complete"].variants}
              transition={tier2["wizard-complete"].transition}
              className="text-center"
            >
              <p className="text-lg font-semibold" style={{ color: neutral[900] }}>
                You&apos;re in.
              </p>
            </motion.div>
          ) : (
            <Button
              onClick={handleNext}
              disabled={isPending}
              className="w-full"
              style={{ backgroundColor: brand.orange, color: "#fff" }}
            >
              {isPending ? (
                <LoaderIcon size={16} className="animate-spin" />
              ) : step === 3 ? (
                <>
                  Complete onboarding
                  <CheckIcon size={16} className="ml-1" />
                </>
              ) : (
                <>
                  Continue
                  <ChevronRightIcon size={16} className="ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
