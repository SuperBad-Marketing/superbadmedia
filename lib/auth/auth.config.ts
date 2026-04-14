/**
 * Edge-safe NextAuth v5 configuration.
 *
 * This file is imported by middleware.ts which runs in Next.js Edge Runtime.
 * It MUST NOT import `better-sqlite3`, `db`, or any native Node.js modules.
 * Database-dependent logic (e.g. `authorize` credential check) lives in
 * `lib/auth/auth.ts` (Node.js-only).
 *
 * The JWT and session callbacks run both at sign-in (Node.js) and during
 * middleware JWT decode (Edge). Keeping them pure ensures Edge compatibility.
 *
 * Owner: A8. Pattern: NextAuth v5 "split config" (Edge + Node separation).
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },

  pages: {
    signIn: "/lite/login",
    error: "/lite/login",
  },

  providers: [],
  // Providers are added in auth.ts — never here (Credentials providers
  // perform DB lookups which require Node.js context).

  callbacks: {
    /**
     * Persist custom claims in the JWT token.
     * `user` is only present on the initial sign-in; subsequent calls
     * carry forward existing token values.
     */
    jwt({ token, user }) {
      if (user) {
        const u = user as { id?: string; role?: string };
        token.id = u.id ?? token.sub;
        token.role = u.role ?? "prospect";
        // brand_dna_complete: starts false; BDA-3 (Wave 3) forces a
        // session refresh after the SuperBad-self profile is completed.
        token.brand_dna_complete = false;
        // critical_flight_complete: starts false; the Node-side jwt
        // override in auth.ts refreshes it against wizard_completions on
        // signIn / signUp / session.update(). SW-4.
        token.critical_flight_complete = false;
      }
      return token;
    },

    /**
     * Shape the session object seen by Server Components and API routes.
     * Called after jwt(); `token` already has the custom claims.
     */
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? (token.sub as string);
        session.user.role = (token.role as string) ?? "prospect";
        session.user.brand_dna_complete =
          (token.brand_dna_complete as boolean) ?? false;
        session.user.critical_flight_complete =
          (token.critical_flight_complete as boolean) ?? false;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
