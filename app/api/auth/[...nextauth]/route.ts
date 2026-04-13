/**
 * NextAuth v5 route handler.
 * Handles GET/POST for all Auth.js endpoints:
 *   /api/auth/signin, /api/auth/signout, /api/auth/session,
 *   /api/auth/csrf, /api/auth/providers, /api/auth/callback/*
 *
 * Owner: A8.
 */
import { handlers } from "@/lib/auth/auth";

export const { GET, POST } = handlers;
