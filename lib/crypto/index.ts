/**
 * lib/crypto — credential encryption primitives.
 *
 * Public surface: vault.encrypt / vault.decrypt.
 * All other Node.js crypto usage is blocked by the `no-direct-crypto`
 * ESLint rule — use this barrel, not raw `node:crypto`.
 */

export { vault } from "./vault";
