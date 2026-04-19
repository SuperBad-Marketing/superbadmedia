"use client";

import { useState, useEffect, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { houseSpring } from "@/lib/design-tokens";
import { fetchAvailableSlots, bookSlot } from "./booking-actions-client";

interface Slot {
  startMs: number;
  endMs: number;
  label: string;
}

export function BookingClient({
  token,
  submissionName,
}: {
  token: string;
  submissionName: string;
}) {
  const firstName = submissionName.split(" ")[0];
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [confirming, startConfirm] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    fetchAvailableSlots().then((result) => {
      setSlots(result);
      setLoading(false);
    });
  }, []);

  function handleBook() {
    if (!selectedSlot) return;
    setError(null);
    startConfirm(async () => {
      const result = await bookSlot(token, selectedSlot.startMs, selectedSlot.endMs);
      if (result.ok) {
        setBooked(true);
        setTimeout(() => router.push(`/lite/intro/${token}`), 2000);
      } else {
        setError(result.error ?? "Something went wrong");
      }
    });
  }

  // Group slots by date
  const slotsByDate: Record<string, Slot[]> = {};
  for (const slot of slots) {
    const dateKey = new Date(slot.startMs).toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
    slotsByDate[dateKey].push(slot);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--neutral-900)",
        position: "relative",
      }}
    >
      {/* Atmosphere */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: [
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(242,140,82,0.18), transparent 60%)",
            "radial-gradient(ellipse 60% 60% at 100% 100%, rgba(178,40,72,0.15), transparent 60%)",
          ].join(","),
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
            Book Your Shoot
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
            Pick a time, {firstName}
          </h1>
          <p
            style={{
              marginTop: 8,
              fontFamily: "var(--font-body)",
              fontSize: 16,
              color: "var(--neutral-300)",
            }}
          >
            About an hour, at your place. We need at least five business days&rsquo;
            notice.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {booked ? (
            <motion.div
              key="booked"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={houseSpring}
              style={{
                marginTop: 48,
                borderRadius: 16,
                border: "1px solid rgba(123,174,126,0.5)",
                background: "rgba(34,34,31,0.85)",
                backdropFilter: "blur(24px)",
                padding: 28,
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-narrative)",
                  fontStyle: "italic",
                  fontSize: 20,
                  color: "var(--semantic-success)",
                }}
              >
                You&rsquo;re locked in.
              </p>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--neutral-300)",
                  marginTop: 8,
                }}
              >
                Confirmation email and calendar invite on the way.
              </p>
            </motion.div>
          ) : loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                marginTop: 48,
                textAlign: "center",
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "var(--neutral-500)",
              }}
            >
              Loading available times&hellip;
            </motion.div>
          ) : slots.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                marginTop: 48,
                borderRadius: 16,
                border: "1px solid rgba(253,245,230,0.12)",
                background: "rgba(34,34,31,0.7)",
                backdropFilter: "blur(24px)",
                padding: 28,
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--neutral-300)",
                }}
              >
                No available slots right now. Check back soon or drop Andy a
                line at{" "}
                <a
                  href="mailto:andy@superbadmedia.com.au"
                  style={{ color: "var(--brand-pink)" }}
                >
                  andy@superbadmedia.com.au
                </a>
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="slots"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...houseSpring, delay: 0.1 }}
              style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 32 }}
            >
              {Object.entries(slotsByDate).map(([dateLabel, daySlots]) => (
                <div key={dateLabel}>
                  <h3
                    style={{
                      fontFamily: "var(--font-label)",
                      fontSize: 10,
                      letterSpacing: "3px",
                      textTransform: "uppercase",
                      color: "var(--brand-pink)",
                      marginBottom: 12,
                    }}
                  >
                    {dateLabel}
                  </h3>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {daySlots.map((slot) => {
                      const isSelected =
                        selectedSlot?.startMs === slot.startMs;
                      const timeLabel = new Date(slot.startMs).toLocaleTimeString(
                        "en-AU",
                        { hour: "numeric", minute: "2-digit", hour12: true },
                      );
                      const endLabel = new Date(slot.endMs).toLocaleTimeString(
                        "en-AU",
                        { hour: "numeric", minute: "2-digit", hour12: true },
                      );
                      return (
                        <motion.button
                          key={slot.startMs}
                          onClick={() => setSelectedSlot(slot)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          transition={houseSpring}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "16px 20px",
                            borderRadius: 12,
                            border: isSelected
                              ? "1px solid rgba(178,40,72,0.6)"
                              : "1px solid rgba(253,245,230,0.12)",
                            background: isSelected
                              ? "rgba(178,40,72,0.15)"
                              : "rgba(34,34,31,0.5)",
                            cursor: "pointer",
                            textAlign: "left",
                            fontFamily: "var(--font-body)",
                            fontSize: 16,
                            color: isSelected
                              ? "var(--brand-cream)"
                              : "var(--neutral-300)",
                          }}
                        >
                          {timeLabel} – {endLabel}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {error && (
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    color: "var(--brand-red)",
                  }}
                >
                  {error}
                </p>
              )}

              <motion.button
                onClick={handleBook}
                disabled={!selectedSlot || confirming}
                whileHover={selectedSlot ? { scale: 1.02 } : undefined}
                whileTap={selectedSlot ? { scale: 0.98 } : undefined}
                transition={houseSpring}
                style={{
                  padding: "16px 32px",
                  borderRadius: 12,
                  border: "none",
                  background: selectedSlot
                    ? "var(--brand-red)"
                    : "var(--neutral-700)",
                  color: selectedSlot
                    ? "var(--brand-cream)"
                    : "var(--neutral-500)",
                  fontFamily: "var(--font-label)",
                  fontSize: 14,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  cursor: selectedSlot ? "pointer" : "not-allowed",
                  opacity: confirming ? 0.6 : 1,
                }}
              >
                {confirming ? "Booking…" : "Lock it in"}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
