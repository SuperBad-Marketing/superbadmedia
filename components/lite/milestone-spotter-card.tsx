"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { houseSpring, neutral, brand } from "@/lib/design-tokens";

interface MilestoneEvidence {
  milestone: {
    contactId: string | null;
    companyId: string | null;
    contactName: string | null;
    companyName: string | null;
    eventType: string;
    eventDate: string;
    dateConfidence: "exact" | "approximate";
    sourceNoteId: string;
    sourceText: string;
    draftMessage: string | null;
  };
  draft: string;
}

type CardState = "idle" | "viewing" | "editing_email" | "editing_sms" | "sending" | "sent" | "dismissed";

export function MilestoneSpotterCard() {
  const [state, setState] = useState<CardState>("idle");
  const [evidence, setEvidence] = useState<MilestoneEvidence | null>(null);
  const [fireId, setFireId] = useState<string | null>(null);
  const [editedMessage, setEditedMessage] = useState("");
  const [editedSubject, setEditedSubject] = useState("Thinking of you");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [error, setError] = useState<string | null>(null);

  const handleEggFired = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.eggId !== "milestone_spotter") return;
    const ev = detail.evidence as MilestoneEvidence;
    setEvidence(ev);
    setFireId(detail.fireId ?? null);
    setEditedMessage(ev.draft ?? "");
    setState("viewing");
  }, []);

  useEffect(() => {
    window.addEventListener("admin-egg-fired", handleEggFired);
    return () => window.removeEventListener("admin-egg-fired", handleEggFired);
  }, [handleEggFired]);

  const handleDismiss = useCallback(async () => {
    if (!evidence) return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/lite/eggs/milestone-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fireId,
          action: "dismiss",
        }),
      });
      if (!res.ok) throw new Error("Failed to dismiss");
      setState("dismissed");
    } catch {
      setError("Couldn't dismiss — try again.");
      setState("viewing");
    }
  }, [evidence, fireId]);

  const handleSend = useCallback(async () => {
    if (!evidence?.milestone.contactId) return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/lite/eggs/milestone-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fireId,
          action: channel === "email" ? "send_email" : "send_sms",
          contactId: evidence.milestone.contactId,
          editedMessage,
          subject: channel === "email" ? editedSubject : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.reason ?? data.error ?? "Send failed");
      }
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed — try again.");
      setState(channel === "email" ? "editing_email" : "editing_sms");
    }
  }, [evidence, channel, editedMessage, editedSubject]);

  if (state === "idle") return null;

  const m = evidence?.milestone;
  const name = m?.contactName ?? m?.companyName ?? "someone";
  const hasEmail = !!m?.contactId;
  const hasPhone = !!m?.contactId;

  return (
    <AnimatePresence>
      {state !== "dismissed" && state !== "sent" ? (
        <motion.div
          key="milestone-card"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={houseSpring}
          className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-48px)]"
        >
          <Card className="border shadow-2xl" style={{ borderColor: neutral[700], backgroundColor: neutral[800] }}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-widest" style={{ color: brand.pink }}>
                  milestone spotter
                </span>
              </div>
              <CardTitle style={{ color: neutral[100] }}>
                {m?.eventType} — {name}
              </CardTitle>
              <p className="text-xs" style={{ color: neutral[500] }}>
                {m?.eventDate}
                {m?.dateConfidence === "approximate" && " (approximate — you might want to check)"}
              </p>
            </CardHeader>

            <CardContent className="space-y-3">
              <div
                className="rounded-lg px-3 py-2 text-sm italic"
                style={{ backgroundColor: neutral[900], color: neutral[300] }}
              >
                <p className="mb-1 text-xs not-italic uppercase tracking-wider" style={{ color: neutral[500] }}>
                  from your notes
                </p>
                &ldquo;{m?.sourceText}&rdquo;
              </div>

              {state === "viewing" && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider" style={{ color: neutral[500] }}>
                    suggested message
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: neutral[300] }}>
                    {evidence?.draft}
                  </p>
                </div>
              )}

              {(state === "editing_email" || state === "editing_sms") && (
                <div className="space-y-2">
                  {state === "editing_email" && (
                    <input
                      type="text"
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      className="w-full rounded-md border px-3 py-1.5 text-sm"
                      style={{
                        backgroundColor: neutral[900],
                        borderColor: neutral[700],
                        color: neutral[100],
                      }}
                      placeholder="Subject line"
                    />
                  )}
                  <Textarea
                    value={editedMessage}
                    onChange={(e) => setEditedMessage(e.target.value)}
                    rows={4}
                    className="resize-none text-sm"
                    style={{
                      backgroundColor: neutral[900],
                      borderColor: neutral[700],
                      color: neutral[100],
                    }}
                  />
                </div>
              )}

              {state === "sending" && (
                <p className="text-center text-sm" style={{ color: neutral[500] }}>
                  Sending…
                </p>
              )}

              {error && (
                <p className="text-sm" style={{ color: brand.red }}>
                  {error}
                </p>
              )}
            </CardContent>

            <CardFooter>
              <div className="flex w-full items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  disabled={state === "sending"}
                  style={{ color: neutral[500] }}
                >
                  Dismiss
                </Button>

                <div className="flex items-center gap-2">
                  {state === "viewing" && (
                    <>
                      {hasEmail && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setChannel("email");
                            setState("editing_email");
                          }}
                          style={{ borderColor: neutral[600], color: neutral[100] }}
                        >
                          Edit & email
                        </Button>
                      )}
                      {hasPhone && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setChannel("sms");
                            setEditedMessage(evidence?.draft ?? "");
                            setState("editing_sms");
                          }}
                          style={{ borderColor: neutral[600], color: neutral[100] }}
                        >
                          Edit & SMS
                        </Button>
                      )}
                      {hasEmail && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setChannel("email");
                            handleSend();
                          }}
                          style={{ backgroundColor: brand.red, color: neutral[100] }}
                        >
                          Send email
                        </Button>
                      )}
                    </>
                  )}

                  {(state === "editing_email" || state === "editing_sms") && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setState("viewing")}
                        style={{ borderColor: neutral[600], color: neutral[100] }}
                      >
                        Back
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSend}
                        disabled={!editedMessage.trim()}
                        style={{ backgroundColor: brand.red, color: neutral[100] }}
                      >
                        Send {channel === "email" ? "email" : "SMS"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          key="milestone-done"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={houseSpring}
          className="fixed bottom-6 right-6 z-50"
        >
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{ backgroundColor: neutral[800], color: neutral[300] }}
          >
            {state === "sent" ? "Sent. Nice one." : "Dismissed."}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
