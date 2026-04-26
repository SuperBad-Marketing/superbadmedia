import type { SoundKey } from "@/lib/sounds";

export type AdminEventType =
  | "deal_bounce_rollback"
  | "inbox_sync"
  | "payment_failed"
  | "quote_accepted";

export type AdminEvent = {
  type: AdminEventType;
  message: string;
  sound?: SoundKey;
  /** ISO timestamp. */
  timestamp: string;
  meta?: Record<string, unknown>;
};

type Listener = (event: AdminEvent) => void;

const listeners = new Set<Listener>();

export function subscribeAdminEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitAdminEvent(event: AdminEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Never let a listener crash the emitter.
    }
  }
}
