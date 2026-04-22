import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { authConfig } from "./auth.config";
import { isBrandDnaCompleteForUser } from "./brand-dna-complete-check";
import { hasCompletedCriticalFlight } from "./has-completed-critical-flight";
import { redeemSubscriberMagicLink } from "./subscriber-magic-link";
import { verifyPassword } from "./password";
import { logActivity } from "@/lib/activity-log";
import { ensureTaskDigestEnqueued } from "@/lib/scheduled-tasks/handlers/task-morning-digest";

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

  events: {
    async signIn({ user: signedInUser }) {
      const u = signedInUser as { id?: string; role?: string };
      if (u.role === "admin" && u.id) {
        void logActivity({
          kind: "admin_session_started",
          body: "Admin signed in.",
          createdBy: u.id,
        });
        void ensureTaskDigestEnqueued();
      }
    },
  },

  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
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

        // --- Admin email + password branch ---
        if (!credentials?.email || typeof credentials.email !== "string") {
          return null;
        }

        const found = await db
          .select({
            id: userTable.id,
            email: userTable.email,
            name: userTable.name,
            role: userTable.role,
            password_hash: userTable.password_hash,
          })
          .from(userTable)
          .where(eq(userTable.email, credentials.email))
          .get();

        if (!found || found.role !== "admin") return null;

        if (found.password_hash) {
          const password =
            typeof credentials.password === "string"
              ? credentials.password
              : "";
          if (!verifyPassword(password, found.password_hash)) return null;
        }

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
