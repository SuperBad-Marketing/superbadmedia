"use client";

import * as React from "react";

import type { AdminEvent } from "./admin-event-bus";

export type AdminEventHandler = (event: AdminEvent) => void;

export function useAdminEvents(onEvent: AdminEventHandler): void {
  const handlerRef = React.useRef(onEvent);
  handlerRef.current = onEvent;

  React.useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      es = new EventSource("/api/admin/events");

      es.onmessage = (msg) => {
        try {
          const event: AdminEvent = JSON.parse(msg.data);
          handlerRef.current(event);
        } catch {
          // Malformed event — skip.
        }
      };

      es.onerror = () => {
        es?.close();
        reconnectTimer = setTimeout(connect, 5_000);
      };
    }

    connect();

    return () => {
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);
}

export type { AdminEvent };
