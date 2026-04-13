/**
 * Auth.js v5 session re-export + TypeScript type augmentation.
 *
 * Import `{ auth }` from here (not from `lib/auth/auth`) in Server Components
 * and API routes. This is the public-facing auth surface for feature code.
 *
 * Session shape:
 *   session.user.id                — user row ID
 *   session.user.email             — email address
 *   session.user.name              — display name (optional)
 *   session.user.role              — "admin" | "client" | "prospect" | "anonymous"
 *   session.user.brandDnaComplete  — whether the SuperBad-self profile is done
 *
 * Owner: A8. Consumers: every admin Server Component + API route.
 *
 * @module
 */
export { auth, signIn, signOut } from "@/lib/auth/auth";

// ── TypeScript type augmentation ─────────────────────────────────────────────

import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/auth/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      brandDnaComplete: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}
