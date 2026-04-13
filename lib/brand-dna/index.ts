/**
 * Brand DNA module — BDA-1 public API surface.
 *
 * Exports the invite issuance and redemption primitives.
 * Assessment UI, profile generation, and blend logic land in BDA-2/BDA-3.
 */
export { issueBrandDnaInvite } from "./issue-invite";
export type { IssueBrandDnaInviteInput, IssueBrandDnaInviteResult } from "./issue-invite";

export { redeemBrandDnaInvite } from "./redeem-invite";
export type { RedeemedBrandDnaInvite } from "./redeem-invite";
