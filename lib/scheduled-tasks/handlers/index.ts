import type { HandlerMap } from "@/lib/scheduled-tasks/worker";
import { QUOTE_BUILDER_HANDLERS } from "./quote-builder";
import { INVOICING_HANDLERS } from "@/lib/invoicing/handlers";

/**
 * Single dispatch map consumed by `lib/scheduled-tasks/worker.ts`.
 *
 * Each feature area contributes its own `HandlerMap` block; this index
 * merges them into one. QB-1 seeds the Quote Builder block; downstream
 * specs (Branded Invoicing, Content Engine, etc.) add theirs by
 * registering a `*_HANDLERS` export and spreading it in below.
 *
 * Worker treats any missing handler for a pending task type as a hard
 * failure (`no handler for {type}`) — the registry is authoritative.
 */
export const HANDLER_REGISTRY: HandlerMap = {
  ...QUOTE_BUILDER_HANDLERS,
  ...INVOICING_HANDLERS,
};
