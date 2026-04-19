"use client";

import { useAdminEvents, type AdminEvent } from "@/lib/events/use-admin-events";
import { useToastWithSound } from "@/components/lite/toast-with-sound";

export function AdminEventToasts() {
  const toast = useToastWithSound();

  useAdminEvents((event: AdminEvent) => {
    switch (event.type) {
      case "deal_bounce_rollback":
        toast.error(event.message, { sound: event.sound ?? "error" });
        break;
      case "payment_failed":
        toast.error(event.message, { sound: event.sound ?? "error" });
        break;
      case "quote_accepted":
        toast.success(event.message, { sound: event.sound ?? "quote-accepted" });
        break;
      default:
        toast(event.message, { sound: event.sound });
    }
  });

  return null;
}
