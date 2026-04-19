"use client";

import { useState, useEffect, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { houseSpring } from "@/lib/design-tokens";
import { fetchAvailableSlots } from "../book/booking-actions-client";

interface Slot {
  startMs: number;
  endMs: number;
  label: string;
}

interface BookingInfo {
  id: string;
  slotStartMs: number;
  slotEndMs: number;
  rescheduleCount: number;
}

export function ManageBookingClient({
  token,
  submissionName,
  booking,
}: {
  token: string;
  submissionName: string;
  booking: BookingInfo;
}) {
  const firstName = submissionName.split(" ")[0];
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "reschedule" | "cancel">("view");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const canReschedule = booking.rescheduleCount < 2;
  const dateLabel = new Date(booking.slotStartMs).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeLabel = new Date(booking.slotStartMs).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  useEffect(() => {
    if (mode === "reschedule") {
      setLoadingSlots(true);
      fetchAvailableSlots().then((result) => {
        setSlots(result);
        setLoadingSlots(false);
      });
    }
  }, [mode]);

  function handleReschedule() {
    if (!selectedSlot) return;
    setError(null);
    startTransition(async () => {
      const { rescheduleAction } = await import(
        "@/lib/intro-funnel/booking-actions"
      );
      const result = await rescheduleAction(
        token,
        selectedSlot.startMs,
        selectedSlot.endMs,
      );
      if (result.ok) {
        setDone("Rescheduled — new confirmation on the way.");
        setTimeout(() => router.push(`/lite/intro/${token}`), 2000);
      } else {
        setError(result.error ?? "Something went wrong");
      }
    });
  }

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const { cancelBookingAction } = await import(
        "@/lib/intro-funnel/booking-actions"
      );
      const result = await cancelBookingAction(token);
      if (result.ok) {
        setDone("Booking cancelled. You can rebook from your portal.");
        setTimeout(() => router.push(`/lite/intro/${token}`), 2000);
      } else {
        setError(result.error ?? "Something went wrong");
      }
    });
  }

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
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(242,140,82,0.18), transparent 60%)",
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
            Your Booking
          </span>
          <h1
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
              color: "var(--brand-cream)",
              margin: "12px 0 0",
            }}
          >
            {dateLabel}
          </h1>
          <p
            style={{
              marginTop: 4,
              fontFamily: "var(--font-body)",
              fontSize: 16,
              color: "var(--neutral-300)",
            }}
          >
            {timeLabel} — about an hour, at your place.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={houseSpring}
              style={{
                marginTop: 48,
                borderRadius: 16,
                border: "1px solid rgba(123,174,126,0.5)",
                background: "rgba(34,34,31,0.85)",
                padding: 28,
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 16,
                  color: "var(--semantic-success)",
                }}
              >
                {done}
              </p>
            </motion.div>
          ) : mode === "view" ? (
            <motion.div
              key="view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...houseSpring, delay: 0.1 }}
              style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 12 }}
            >
              {canReschedule && (
                <motion.button
                  onClick={() => setMode("reschedule")}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={houseSpring}
                  style={{
                    padding: "16px 24px",
                    borderRadius: 12,
                    border: "1px solid rgba(253,245,230,0.12)",
                    background: "rgba(34,34,31,0.7)",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    fontSize: 16,
                    color: "var(--brand-cream)",
                    textAlign: "left",
                  }}
                >
                  Reschedule
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--font-body)",
                      fontSize: 12,
                      color: "var(--neutral-500)",
                      marginTop: 4,
                    }}
                  >
                    {2 - booking.rescheduleCount} reschedule
                    {2 - booking.rescheduleCount === 1 ? "" : "s"} remaining
                  </span>
                </motion.button>
              )}

              <motion.button
                onClick={() => setMode("cancel")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={houseSpring}
                style={{
                  padding: "16px 24px",
                  borderRadius: 12,
                  border: "1px solid rgba(178,40,72,0.3)",
                  background: "rgba(34,34,31,0.5)",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  fontSize: 16,
                  color: "var(--neutral-300)",
                  textAlign: "left",
                }}
              >
                Cancel booking
              </motion.button>

              <motion.a
                href={`/lite/intro/${token}`}
                whileHover={{ scale: 1.02 }}
                transition={houseSpring}
                style={{
                  display: "block",
                  padding: "16px 24px",
                  textAlign: "center",
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--neutral-500)",
                  textDecoration: "none",
                  marginTop: 16,
                }}
              >
                ← Back to portal
              </motion.a>
            </motion.div>
          ) : mode === "cancel" ? (
            <motion.div
              key="cancel"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={houseSpring}
              style={{
                marginTop: 48,
                borderRadius: 16,
                border: "1px solid rgba(178,40,72,0.4)",
                background: "rgba(34,34,31,0.85)",
                padding: 28,
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
                Are you sure?
              </h3>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--neutral-300)",
                  marginTop: 12,
                }}
              >
                {booking.slotStartMs - Date.now() < 48 * 60 * 60 * 1000
                  ? "This is inside 48 hours — your booking fee won't be refundable."
                  : "Your booking fee will be fully refunded."}
              </p>

              {error && (
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    color: "var(--brand-red)",
                    marginTop: 12,
                  }}
                >
                  {error}
                </p>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                <button
                  onClick={handleCancel}
                  disabled={pending}
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--brand-red)",
                    color: "var(--brand-cream)",
                    fontFamily: "var(--font-label)",
                    fontSize: 12,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    cursor: pending ? "not-allowed" : "pointer",
                    opacity: pending ? 0.6 : 1,
                  }}
                >
                  {pending ? "Cancelling…" : "Cancel booking"}
                </button>
                <button
                  onClick={() => setMode("view")}
                  disabled={pending}
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    borderRadius: 8,
                    border: "1px solid rgba(253,245,230,0.2)",
                    background: "transparent",
                    color: "var(--neutral-300)",
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Keep it
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="reschedule"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={houseSpring}
              style={{ marginTop: 48 }}
            >
              {loadingSlots ? (
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    color: "var(--neutral-500)",
                    textAlign: "center",
                  }}
                >
                  Loading available times&hellip;
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {Object.entries(slotsByDate).map(([dateKey, daySlots]) => (
                    <div key={dateKey}>
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
                        {dateKey}
                      </h3>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        {daySlots.map((slot) => {
                          const isSelected =
                            selectedSlot?.startMs === slot.startMs;
                          const timeStr = new Date(
                            slot.startMs,
                          ).toLocaleTimeString("en-AU", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          });
                          const endStr = new Date(
                            slot.endMs,
                          ).toLocaleTimeString("en-AU", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          });
                          return (
                            <button
                              key={slot.startMs}
                              onClick={() => setSelectedSlot(slot)}
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
                              {timeStr} – {endStr}
                            </button>
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

                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      onClick={handleReschedule}
                      disabled={!selectedSlot || pending}
                      style={{
                        flex: 1,
                        padding: "14px 24px",
                        borderRadius: 12,
                        border: "none",
                        background: selectedSlot
                          ? "var(--brand-red)"
                          : "var(--neutral-700)",
                        color: selectedSlot
                          ? "var(--brand-cream)"
                          : "var(--neutral-500)",
                        fontFamily: "var(--font-label)",
                        fontSize: 12,
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        cursor: selectedSlot ? "pointer" : "not-allowed",
                        opacity: pending ? 0.6 : 1,
                      }}
                    >
                      {pending ? "Moving…" : "Move to this time"}
                    </button>
                    <button
                      onClick={() => {
                        setMode("view");
                        setSelectedSlot(null);
                      }}
                      style={{
                        padding: "14px 24px",
                        borderRadius: 12,
                        border: "1px solid rgba(253,245,230,0.2)",
                        background: "transparent",
                        color: "var(--neutral-300)",
                        fontFamily: "var(--font-body)",
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      Never mind
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
