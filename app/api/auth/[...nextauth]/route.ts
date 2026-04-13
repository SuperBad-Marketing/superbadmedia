/**
 * Auth.js v5 route handler.
 *
 * Handles all NextAuth API routes under /api/auth/:
 *   GET  /api/auth/session
 *   POST /api/auth/session
 *   GET  /api/auth/providers
 *   POST /api/auth/signin
 *   POST /api/auth/signout
 *   GET  /api/auth/callback/:provider
 *   GET  /api/auth/csrf
 *
 * Owner: A8. Do not add logic here — keep it as the minimal handler.
 */
import { handlers } from "@/lib/auth/auth";

export const { GET, POST } = handlers;
