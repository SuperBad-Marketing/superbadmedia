/**
 * Auth.js v5 root configuration.
 *
 * Admin authentication for SuperBad Lite. Uses a Credentials provider
 * against the `user` table. Andy's password lives in the `ADMIN_PASSWORD`
 * env var — no password hash stored in DB (single admin user, v1.0).
 *
 * JWT strategy (default for Credentials provider). Session shape includes
 * `role` and `brandDnaComplete` so middleware can enforce both gates
 * without a DB round-trip on every request.
 *
 * `brandDnaComplete` is set once at sign-in and updated when BDA-3 calls
 * `session.update({ brandDnaComplete: true })` after the profile is saved.
 *
 * Owner: A8. Consumers: middleware.ts, lib/auth/session.ts, every admin
 * Server Component.
 *
 * @module
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@/lib/auth/permissions";

// Re-export pure gate helpers so middleware.ts can import from a single place.
// The canonical implementations live in has-completed-critical-flight.ts,
// which is free of NextAuth imports and safely testable in Vitest.
export {
  applyBrandDnaGate,
  isAdminPath,
  type GateDecision,
} from "@/lib/auth/has-completed-critical-flight";

// ── NextAuth configuration ───────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const adminEmail =
          process.env.ADMIN_EMAIL ?? "andy@superbadmedia.com.au";
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
          console.error("[auth] ADMIN_PASSWORD env var is not set");
          return null;
        }

        if (
          credentials.email !== adminEmail ||
          credentials.password !== adminPassword
        ) {
          return null;
        }

        // Dynamic import avoids bundling better-sqlite3 in middleware/edge
        const { db } = await import("@/lib/db");
        const { user } = await import("@/lib/db/schema/user");
        const { eq } = await import("drizzle-orm");

        const existing = await db
          .select()
          .from(user)
          .where(eq(user.email, adminEmail))
          .limit(1);

        if (existing.length === 0) {
          // First-ever login — create admin user row
          const id = crypto.randomUUID();
          const now = Date.now();
          await db.insert(user).values({
            id,
            email: adminEmail,
            name: "Andy Robinson",
            role: "admin",
            timezone: "Australia/Melbourne",
            created_at_ms: now,
            first_signed_in_at_ms: now,
          });
          return { id, email: adminEmail, name: "Andy Robinson", role: "admin" as Role };
        }

        const row = existing[0];

        // Set first_signed_in_at_ms on first successful login
        if (!row.first_signed_in_at_ms) {
          await db
            .update(user)
            .set({ first_signed_in_at_ms: Date.now() })
            .where(eq(user.id, row.id));
        }

        return {
          id: row.id,
          email: row.email,
          name: row.name ?? undefined,
          role: row.role as Role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Populate JWT on sign-in
        token.role = (user as { role: Role }).role;
        // brandDnaComplete starts false — BDA-3 updates via session.update()
        token.brandDnaComplete = false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { role?: Role }).role = token.role as Role;
        (session.user as { brandDnaComplete?: boolean }).brandDnaComplete =
          Boolean(token.brandDnaComplete);
      }
      return session;
    },
  },

  pages: {
    signIn: "/lite/login",
    error: "/lite/login",
  },
});
