"use client";

import { motion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import type { IntroFunnelSubmissionRow } from "@/lib/db/schema/intro-funnel-submissions";
import type { ContactRow } from "@/lib/db/schema/contacts";
import type { DealRow } from "@/lib/db/schema/deals";
import type { CompanyRow } from "@/lib/db/schema/companies";
import type { IntroFunnelPaymentRow } from "@/lib/db/schema/intro-funnel-payments";
import type { IntroFunnelBookingRow } from "@/lib/db/schema/intro-funnel-bookings";
import type { IntroFunnelReflectionRow } from "@/lib/db/schema/intro-funnel-reflections";
import { QuestionnairePanel } from "./questionnaire-panel";
import { PaymentPanel } from "./payment-panel";

interface PortalShellProps {
  token: string;
  submission: IntroFunnelSubmissionRow;
  contact: ContactRow | null;
  deal: DealRow | null;
  company: CompanyRow | null;
  payment: IntroFunnelPaymentRow | null;
  booking: IntroFunnelBookingRow | null;
  reflection: IntroFunnelReflectionRow | null;
}

export function PortalShell({
  token,
  submission,
  contact,
  deal,
  company,
  payment,
  booking,
  reflection,
}: PortalShellProps) {
  const state = submission.funnel_state;
  const firstName = submission.submitted_name.split(" ")[0];

  const isPrePayment = [
    "contact_submitted",
    "questionnaire_in_progress",
    "questionnaire_complete",
  ].includes(state);

  const isBookedPhase = [
    "shoot_booked",
    "shoot_approaching",
    "shoot_morning_of",
  ].includes(state);

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
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(242,140,82,0.18), transparent 60%)",
            "radial-gradient(ellipse 60% 60% at 100% 100%, rgba(178,40,72,0.15), transparent 60%)",
            "radial-gradient(ellipse 60% 60% at 0% 80%, rgba(244,160,176,0.10), transparent 60%)",
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
            {isBookedPhase
              ? "Your shoot is coming up."
              : state === "shoot_completed_awaiting_deliverables"
                ? "Your shoot's done — photos coming soon."
                : state === "deliverables_ready"
                  ? "Everything from your shoot is ready."
                  : state === "reflection_complete"
                    ? "Thanks for taking the time."
                    : state === "portal_dormant"
                      ? "We're here when you're ready."
                      : "Here\u2019s what\u2019s next."}
          </p>
        </motion.div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 48 }}>
          {/* --- Pre-payment flow (questionnaire + payment) --- */}
          {isPrePayment && (
            <>
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
            </>
          )}

          {/* --- Paid: book your shoot --- */}
          {state === "paid" && (
            <PortalCard title="Book your shoot" subtitle="Choose a time" active delay={0.1}>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--neutral-300)",
                  marginBottom: 16,
                }}
              >
                Pick a time that works. We need at least five business days&rsquo; notice.
              </p>
              <a
                href={`/lite/intro/${token}/book`}
                style={{
                  display: "inline-block",
                  padding: "14px 28px",
                  borderRadius: 12,
                  background: "var(--brand-red)",
                  color: "var(--brand-cream)",
                  fontFamily: "var(--font-label)",
                  fontSize: 12,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  textDecoration: "none",
                }}
              >
                Choose a time
              </a>
            </PortalCard>
          )}

          {/* --- Booked phase: booking details --- */}
          {isBookedPhase && booking && (
            <BookingCard
              token={token}
              state={state}
              booking={booking}
            />
          )}

          {/* --- Awaiting deliverables --- */}
          {state === "shoot_completed_awaiting_deliverables" && (
            <PortalCard
              title="Your shoot is done"
              subtitle="Photos coming"
              active={false}
              delay={0.1}
            >
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--neutral-300)",
                  lineHeight: 1.6,
                }}
              >
                We&rsquo;re editing your photos and putting together your plan.
                Everything will land here together — usually about a week after the shoot.
              </p>
            </PortalCard>
          )}

          {/* --- Deliverables ready --- */}
          {state === "deliverables_ready" && (
            <>
              <PortalCard
                title="Everything from your shoot"
                subtitle="Ready"
                active
                delay={0.1}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <a
                    href={`/portal/${token}/gallery`}
                    style={{
                      display: "block",
                      padding: "20px",
                      borderRadius: 12,
                      border: "1px solid rgba(253,245,230,0.12)",
                      background: "rgba(34,34,31,0.5)",
                      textDecoration: "none",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 16,
                        color: "var(--brand-cream)",
                      }}
                    >
                      Your photos &amp; video
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontFamily: "var(--font-body)",
                        fontSize: 12,
                        color: "var(--brand-pink)",
                        marginTop: 4,
                      }}
                    >
                      The moments we caught.
                    </span>
                  </a>
                </div>
              </PortalCard>

              {!reflection?.completed_at_ms && (
                <PortalCard
                  title="One more thing"
                  subtitle="A few minutes"
                  active
                  delay={0.2}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 14,
                      color: "var(--neutral-300)",
                      marginBottom: 16,
                    }}
                  >
                    A short reflection — there&rsquo;s something at the end worth seeing.
                  </p>
                  <a
                    href={`/lite/intro/${token}/reflect`}
                    style={{
                      display: "inline-block",
                      padding: "12px 24px",
                      borderRadius: 10,
                      background: "var(--brand-red)",
                      color: "var(--brand-cream)",
                      fontFamily: "var(--font-label)",
                      fontSize: 12,
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      textDecoration: "none",
                    }}
                  >
                    Start reflection
                  </a>
                </PortalCard>
              )}
            </>
          )}

          {/* --- Reflection complete --- */}
          {state === "reflection_complete" && (
            <PortalCard
              title="Everything from your shoot"
              subtitle="Ready"
              active={false}
              delay={0.1}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <a
                  href={`/portal/${token}/gallery`}
                  style={{
                    display: "block",
                    padding: "20px",
                    borderRadius: 12,
                    border: "1px solid rgba(253,245,230,0.12)",
                    background: "rgba(34,34,31,0.5)",
                    textDecoration: "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 16,
                      color: "var(--brand-cream)",
                    }}
                  >
                    Your photos &amp; video
                  </span>
                </a>
              </div>
            </PortalCard>
          )}

          {/* --- Portal dormant --- */}
          {state === "portal_dormant" && (
            <PortalCard
              title="Your shoot"
              subtitle="Available"
              active={false}
              delay={0.1}
            >
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--neutral-300)",
                }}
              >
                Your gallery and plan are still here. We&rsquo;re around if you want to
                pick things up.
              </p>
              <a
                href={`/portal/${token}/gallery`}
                style={{
                  display: "inline-block",
                  marginTop: 12,
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--brand-pink)",
                  textDecoration: "none",
                }}
              >
                View gallery →
              </a>
            </PortalCard>
          )}

          {/* What to expect — show for pre-payment and paid states */}
          {(isPrePayment || state === "paid") && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...houseSpring, delay: 0.3 }}
              style={{
                borderRadius: 16,
                border: "1px solid rgba(253,245,230,0.12)",
                background: "rgba(34,34,31,0.7)",
                backdropFilter: "blur(24px)",
                boxShadow: "inset 0 1px 0 rgba(253,245,230,0.08), 0 2px 12px rgba(0,0,0,0.3)",
                padding: 28,
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 10,
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  color: "var(--brand-pink)",
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
                  gap: 16,
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
                      lineHeight: 1.6,
                      color: "var(--brand-cream)",
                      paddingLeft: 16,
                      borderLeft: "2px solid rgba(178,40,72,0.4)",
                    }}
                  >
                    {text}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>
      </div>
    </main>
  );
}

function BookingCard({
  token,
  state,
  booking,
}: {
  token: string;
  state: string;
  booking: IntroFunnelBookingRow;
}) {
  const dateLabel = new Date(booking.slot_start_at_ms).toLocaleDateString(
    "en-AU",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );
  const timeLabel = new Date(booking.slot_start_at_ms).toLocaleTimeString(
    "en-AU",
    { hour: "numeric", minute: "2-digit", hour12: true },
  );

  const isUrgent = state === "shoot_approaching" || state === "shoot_morning_of";

  return (
    <PortalCard
      title="Your shoot"
      subtitle={
        state === "shoot_morning_of"
          ? "Today"
          : state === "shoot_approaching"
            ? "Coming up"
            : "Booked"
      }
      active={isUrgent}
      delay={0.1}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <p
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: 20,
              color: "var(--brand-cream)",
              margin: 0,
            }}
          >
            {dateLabel}
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "var(--neutral-300)",
              marginTop: 4,
            }}
          >
            {timeLabel} — about an hour, at your place.
          </p>
        </div>

        <div
          style={{
            borderTop: "1px solid rgba(253,245,230,0.08)",
            paddingTop: 16,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--brand-pink)",
              margin: 0,
            }}
          >
            What to wear
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "var(--neutral-300)",
              margin: 0,
            }}
          >
            Whatever you&rsquo;d normally wear at work. Seriously.
          </p>
        </div>

        {state === "shoot_booked" && booking.reschedule_count < 2 && (
          <a
            href={`/lite/intro/${token}/manage-booking`}
            style={{
              display: "inline-block",
              marginTop: 8,
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--neutral-500)",
              textDecoration: "none",
            }}
          >
            Need to reschedule or cancel?
          </a>
        )}
      </div>
    </PortalCard>
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
          ? "1px solid rgba(178,40,72,0.5)"
          : "1px solid rgba(253,245,230,0.12)",
        background: active
          ? "rgba(34,34,31,0.85)"
          : "rgba(34,34,31,0.5)",
        backdropFilter: "blur(24px)",
        boxShadow: active
          ? "inset 0 1px 0 rgba(253,245,230,0.08), 0 8px 32px rgba(178,40,72,0.12)"
          : "inset 0 1px 0 rgba(253,245,230,0.06), 0 2px 12px rgba(0,0,0,0.2)",
        padding: 28,
        opacity: active ? 1 : 0.7,
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
