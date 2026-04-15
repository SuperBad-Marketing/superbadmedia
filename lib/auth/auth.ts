/**
 * NextAuth v5 full configuration — Node.js only.
 *
 * Imports `db` (better-sqlite3) so it MUST NOT be imported in middleware.ts
 * or any Edge-runtime path. Server Components, API routes, and Server Actions
 * should import from `@/lib/auth/session` (which re-exports `auth()` here).
 *
 * Middleware imports from `@/lib/auth/auth.config` instead (Edge-safe split).
 *
 * PATCHES_OWED: The Credentials `authorize` function currently validates
 * email existence without a password check — no `password_hash` column
 * exists on the `user` table in A8. The admin login UI + password seeding
 * lands in a later Wave 2 session (B-series). Until then, the gate is the
 * BRAND_DNA_GATE_BYPASS env var. Track under PATCHES_OWED
 * `a8_credentials_provider_no_password`.
 *
 * Owner: A8.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { authConfig } from "./auth.config";
import { isBrandDnaCompleteForUser } from "./brand-dna-complete-check";
import { hasCompletedCriticalFlight } from "./has-completed-critical-flight";
import { redeemSubscriberMagicLink } from "./subscriber-magic-link";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,

  callbacks: {
    ...authConfig.callbacks,
    /**
     * Node-side jwt override (BDA-4). Runs the Edge-safe base first to keep
     * id/role/default-brand_dna_complete stable, then — on sign-in or an
     * explicit `session.update()` trigger — re-queries `brand_dna_profiles`
     * for the SuperBad-self row and flips `token.brand_dna_complete`.
     *
     * Kill-switch (`brand_dna_assessment_enabled`) gates the DB call via
     * `isBrandDnaCompleteForUser`, so deployments without Brand DNA pay no
     * cost here.
     */
    async jwt(params) {
      const token = await authConfig.callbacks!.jwt!(params);
      const { trigger } = params;
      const shouldRefresh =
        trigger === "signIn" || trigger === "signUp" || trigger === "update";
      if (!shouldRefresh) return token;
      const userId =
        (token.id as string | undefined) ?? (token.sub as string | undefined);
      if (!userId) return token;
      token.brand_dna_complete = await isBrandDnaCompleteForUser(userId);
      token.critical_flight_complete = await hasCompletedCriticalFlight(userId);
      return token;
    },
  },

  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        subscriberLoginToken: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        // --- Subscriber magic-link branch (SB-6a) ---
        // If a token is presented, redeem it: promotes prospect→client,
        // marks token consumed, logs activity. On success returns the
        // user for session issuance. Admin path is unaffected.
        if (
          typeof credentials?.subscriberLoginToken === "string" &&
          credentials.subscriberLoginToken.length > 0
        ) {
          const outcome = await redeemSubscriberMagicLink(
            credentials.subscriberLoginToken,
          );
          if (!outcome.ok) return null;
          const u = await db
            .select({
              id: userTable.id,
              email: userTable.email,
              name: userTable.name,
              role: userTable.role,
            })
            .from(userTable)
            .where(eq(userTable.id, outcome.userId))
            .get();
          if (!u) return null;
          return {
            id: u.id,
            email: u.email,
            name: u.name ?? undefined,
            role: u.role,
          };
        }

        // --- Admin email-only branch (original A8 behaviour) ---
        if (!credentials?.email || typeof credentials.email !== "string") {
          return null;
        }

        const found = await db
          .select({
            id: userTable.id,
            email: userTable.email,
            name: userTable.name,
            role: userTable.role,
          })
          .from(userTable)
          .where(eq(userTable.email, credentials.email))
          .get();

        if (!found || found.role !== "admin") return null;

        return {
          id: found.id,
          email: found.email,
          name: found.name ?? undefined,
          role: found.role,
        };
      },
    }),
  ],
});
