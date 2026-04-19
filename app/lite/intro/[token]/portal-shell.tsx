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
    <main
      style={{
        minHeight: "100vh",
        background: "var(--neutral-900)",
        position: "relative",
      }}
    >
      {/* Atmosphere gradients */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: [
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(242,140,82,0.10), transparent 60%)",
            "radial-gradient(ellipse 60% 60% at 100% 100%, rgba(178,40,72,0.08), transparent 60%)",
            "radial-gradient(ellipse 60% 60% at 0% 80%, rgba(244,160,176,0.05), transparent 60%)",
          ].join(","),
        }}
      />
      {/* Noise texture */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          opacity: 0.035,
          mixBlendMode: "overlay",
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: 600,
          margin: "0 auto",
          padding: "96px 24px",
        }}
      >
        {/* Welcome header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={houseSpring}
        >
          <span
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "var(--brand-pink)",
            }}
          >
            Your Portal
          </span>
          <h1
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
              lineHeight: 1.15,
              letterSpacing: "-0.5px",
              color: "var(--brand-cream)",
              margin: "12px 0 0",
            }}
          >
            Welcome, {firstName}
          </h1>
          <p
            style={{
              marginTop: 8,
              fontFamily: "var(--font-body)",
              fontSize: 16,
              color: "var(--neutral-300)",
            }}
          >
            Here&rsquo;s what&rsquo;s next.
          </p>
        </motion.div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 48 }}>
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
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--neutral-500)",
                }}
              >
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
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    color: "var(--neutral-500)",
                  }}
                >
                  Finish the questionnaire above to unlock booking.
                </p>
              )}
            {payment?.status === "succeeded" && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--semantic-success)",
                }}
              >
                Payment received — $
                {((payment.amount_cents ?? 0) / 100).toFixed(2)}
              </p>
            )}
          </PortalCard>

          {/* Post-payment states rendered by IF-2 */}
          {state === "paid" && (
            <PortalCard title="Book your shoot" subtitle="Choose a time" active delay={0}>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--neutral-300)",
                }}
              >
                Calendar booking will be available in a future update.
              </p>
            </PortalCard>
          )}

          {/* What to expect */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...houseSpring, delay: 0.3 }}
            style={{
              borderRadius: 16,
              border: "1px solid rgba(253,245,230,0.08)",
              background: "rgba(34,34,31,0.6)",
              backdropFilter: "blur(10px)",
              boxShadow: "inset 0 1px 0 rgba(253,245,230,0.06)",
              padding: 28,
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 10,
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "var(--neutral-500)",
                margin: 0,
              }}
            >
              What to expect
            </h3>
            <ul
              style={{
                marginTop: 20,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {[
                "A 60-minute on-site shoot, at your place of business.",
                "1 short-form video and 10 edited photographs.",
                "A bespoke 6-week marketing plan.",
                "60 days of portal access after your shoot.",
                "Everything lands in your portal at once, usually about a week after.",
              ].map((text, i) => (
                <li
                  key={i}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "var(--neutral-300)",
                  }}
                >
                  {text}
                </li>
              ))}
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
      style={{
        borderRadius: 16,
        border: active
          ? "1px solid rgba(178,40,72,0.4)"
          : "1px solid rgba(253,245,230,0.08)",
        background: active
          ? "rgba(34,34,31,0.8)"
          : "rgba(34,34,31,0.4)",
        backdropFilter: "blur(10px)",
        boxShadow: active
          ? "inset 0 1px 0 rgba(253,245,230,0.06), 0 4px 24px rgba(178,40,72,0.08)"
          : "inset 0 1px 0 rgba(253,245,230,0.04)",
        padding: 28,
        opacity: active ? 1 : 0.6,
        transition: "opacity 300ms ease, border-color 300ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-narrative)",
            fontStyle: "italic",
            fontSize: 18,
            color: "var(--brand-cream)",
            margin: 0,
          }}
        >
          {title}
        </h3>
        <span
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 10,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: active ? "var(--brand-pink)" : "var(--neutral-500)",
          }}
        >
          {subtitle}
        </span>
      </div>
      {children}
    </motion.div>
  );
}
