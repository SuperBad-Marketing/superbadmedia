"use client";

import { motion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import type { IntroFunnelSubmissionRow } from "@/lib/db/schema/intro-funnel-submissions";
import type { ContactRow } from "@/lib/db/schema/contacts";
import type { DealRow } from "@/lib/db/schema/deals";
import type { CompanyRow } from "@/lib/db/schema/companies";
import type { IntroFunnelPaymentRow } from "@/lib/db/schema/intro-funnel-payments";
import { QuestionnairePanel } from "./questionnaire-panel";
import { PaymentPanel } from "./payment-panel";

interface PortalShellProps {
  token: string;
  submission: IntroFunnelSubmissionRow;
  contact: ContactRow | null;
  deal: DealRow | null;
  company: CompanyRow | null;
  payment: IntroFunnelPaymentRow | null;
}

export function PortalShell({
  token,
  submission,
  contact,
  deal,
  company,
  payment,
}: PortalShellProps) {
  const state = submission.funnel_state;
  const firstName = submission.submitted_name.split(" ")[0];

  return (
    <main className="min-h-screen bg-[color:var(--color-neutral-950)] px-6 py-16">
      <div className="mx-auto max-w-[600px]">
        {/* Welcome header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={houseSpring}
        >
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.1] text-[color:var(--color-brand-cream)]">
            Welcome {firstName}
          </h1>
          <p className="mt-2 font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-neutral-300)]">
            Here&rsquo;s what&rsquo;s next.
          </p>
        </motion.div>

        <div className="mt-10 space-y-6">
          {/* Questionnaire card */}
          {(state === "contact_submitted" ||
            state === "questionnaire_in_progress") && (
            <PortalCard
              title="Tell us more"
              subtitle={`${3 - submission.questionnaire_sections_completed} sections left`}
              active
              delay={0.1}
            >
              <QuestionnairePanel
                token={token}
                submissionId={submission.id}
                shape={submission.shape}
                sectionsCompleted={submission.questionnaire_sections_completed}
                existingAnswers={
                  submission.questionnaire_answers_json as Record<
                    string,
                    unknown
                  > | null
                }
              />
            </PortalCard>
          )}

          {state === "questionnaire_complete" && (
            <PortalCard
              title="Tell us more"
              subtitle="Done"
              active={false}
              delay={0}
            >
              <p className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
                All sections complete.
              </p>
            </PortalCard>
          )}

          {/* Payment card */}
          <PortalCard
            title="Pay now & book your shoot"
            subtitle={
              state === "questionnaire_complete"
                ? "Ready"
                : payment?.status === "succeeded"
                  ? "Paid"
                  : "Complete questionnaire first"
            }
            active={state === "questionnaire_complete"}
            delay={0.2}
          >
            {state === "questionnaire_complete" && (
              <PaymentPanel token={token} submissionId={submission.id} />
            )}
            {state !== "questionnaire_complete" &&
              payment?.status !== "succeeded" && (
                <p className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
                  Finish the questionnaire above to unlock booking.
                </p>
              )}
            {payment?.status === "succeeded" && (
              <p className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-semantic-success)]">
                Payment received — $
                {((payment.amount_cents ?? 0) / 100).toFixed(2)}
              </p>
            )}
          </PortalCard>

          {/* Post-payment states rendered by IF-2 */}
          {state === "paid" && (
            <PortalCard title="Book your shoot" subtitle="Choose a time" active delay={0}>
              <p className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-300)]">
                Calendar booking will be available in a future update.
              </p>
            </PortalCard>
          )}

          {/* What to expect */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...houseSpring, delay: 0.3 }}
            className="rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-900)] p-6"
          >
            <h3 className="font-[family-name:var(--font-label)] text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-neutral-500)]">
              WHAT TO EXPECT
            </h3>
            <ul className="mt-4 space-y-3 font-[family-name:var(--font-body)] text-[14px] leading-[1.5] text-[color:var(--color-neutral-300)]">
              <li>A 60-minute on-site shoot, at your place of business.</li>
              <li>1 short-form video and 10 edited photographs.</li>
              <li>A bespoke 6-week marketing plan.</li>
              <li>60 days of portal access after your shoot.</li>
              <li>
                Everything lands in your portal at once, usually about a week
                after.
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </main>
  );
}

function PortalCard({
  title,
  subtitle,
  active,
  delay,
  children,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...houseSpring, delay }}
      className={`rounded-lg border p-6 ${
        active
          ? "border-[color:var(--color-brand-red)]/30 bg-[color:var(--color-neutral-900)]"
          : "border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-900)] opacity-70"
      }`}
    >
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-[family-name:var(--font-body)] text-[16px] font-medium text-[color:var(--color-brand-cream)]">
          {title}
        </h3>
        <span className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[0.1em] text-[color:var(--color-neutral-500)]">
          {subtitle}
        </span>
      </div>
      {children}
    </motion.div>
  );
}
