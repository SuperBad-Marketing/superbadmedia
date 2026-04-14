/**
 * NextAuth v5 session utilities for Server Components and API routes.
 *
 * Re-exports `auth()` from the full auth config (Node.js-only).
 * Includes TypeScript module augmentation so `session.user` is fully typed
 * with SuperBad Lite's custom fields.
 *
 * Usage in a Server Component:
 *   import { auth } from "@/lib/auth/session";
 *   const session = await auth();
 *   if (!session) redirect("/lite/login");
 *   const { role, brand_dna_complete } = session.user;
 *
 * Owner: A8.
 */
export { auth, signIn, signOut } from "./auth";

// ── TypeScript module augmentation ──────────────────────────────────────────

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** Row id from the `user` table. */
      id: string;
      /** Coarse access role from `lib/auth/permissions.ts`. */
      role: string;
      /**
       * True once the SuperBad-self Brand DNA profile is complete.
       * Cached in the JWT at sign-in; refreshed by BDA-3 (Wave 3).
       * Middleware reads this to enforce FOUNDATIONS §11.8 gate.
       */
      brand_dna_complete: boolean;
      /**
       * True once every critical-flight wizard
       * (`settings.wizards.critical_flight_wizards`) has a
       * `wizard_completions` row for this user. Cached in the JWT at
       * sign-in; refreshed on `session.update()`. Middleware reads this
       * for gate 2 per spec §8.1. SW-4.
       */
      critical_flight_complete: boolean;
    } & DefaultSession["user"];
  }
}

// JWT token augmentation: extend via @auth/core/jwt if needed in future
// sessions. The session augmentation above is sufficient for Server Component
// and middleware usage via req.auth / auth().

