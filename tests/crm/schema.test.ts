/**
 * SP-1: schema enum / shape sanity.
 * Pure TypeScript-level checks — no DB required.
 */
import { describe, it, expect } from "vitest";
import { DEAL_STAGES, DEAL_WON_OUTCOMES, DEAL_LOSS_REASONS, DEAL_SUBSCRIPTION_STATES, DEAL_BILLING_CADENCES } from "@/lib/db/schema/deals";
import { COMPANY_SHAPES, COMPANY_BILLING_MODES, TRIAL_SHOOT_STATUSES } from "@/lib/db/schema/companies";
import { CONTACT_EMAIL_STATUSES } from "@/lib/db/schema/contacts";
import { WEBHOOK_PROVIDERS, WEBHOOK_RESULTS } from "@/lib/db/schema/webhook-events";
import {
  normaliseEmail,
  normalisePhone,
  normaliseCompanyName,
  normaliseDomain,
} from "@/lib/crm/normalise";

describe("SP-1 enum shape", () => {
  it("deals.stage is the locked 8-tuple", () => {
    expect([...DEAL_STAGES]).toEqual([
      "lead",
      "contacted",
      "conversation",
      "trial_shoot",
      "quoted",
      "negotiating",
      "won",
      "lost",
    ]);
  });

  it("deals.won_outcome includes 'project' (Quote Builder §5.6 cross-spec)", () => {
    expect([...DEAL_WON_OUTCOMES]).toEqual(["retainer", "saas", "project"]);
  });

  it("deals.loss_reason is the locked 7-tuple", () => {
    expect(DEAL_LOSS_REASONS).toHaveLength(7);
  });

  it("deals.subscription_state is the 8-tuple (Quote Builder §5.6 + past_due via subscription-lifecycle webhooks)", () => {
    expect([...DEAL_SUBSCRIPTION_STATES]).toEqual([
      "active",
      "past_due",
      "paused",
      "pending_early_exit",
      "cancelled_paid_remainder",
      "cancelled_buyout",
      "cancelled_post_term",
      "ended_gracefully",
    ]);
  });

  it("deals.billing_cadence is monthly | annual_monthly | annual_upfront", () => {
    expect([...DEAL_BILLING_CADENCES]).toEqual([
      "monthly",
      "annual_monthly",
      "annual_upfront",
    ]);
  });

  it("companies.shape is the 3-tuple (F1.b canonical)", () => {
    expect([...COMPANY_SHAPES]).toEqual([
      "solo_founder",
      "founder_led_team",
      "multi_stakeholder_company",
    ]);
  });

  it("companies.billing_mode is stripe | manual", () => {
    expect([...COMPANY_BILLING_MODES]).toEqual(["stripe", "manual"]);
  });

  it("trial_shoot_status is the 6-tuple", () => {
    expect(TRIAL_SHOOT_STATUSES).toHaveLength(6);
  });

  it("contacts.email_status is the 6-tuple (LG-1 added 'unsubscribed')", () => {
    expect(CONTACT_EMAIL_STATUSES).toHaveLength(6);
    expect(CONTACT_EMAIL_STATUSES).toContain("unsubscribed");
  });

  it("webhook_events.provider is stripe | resend", () => {
    expect([...WEBHOOK_PROVIDERS]).toEqual(["stripe", "resend"]);
    expect([...WEBHOOK_RESULTS]).toEqual(["ok", "error", "skipped"]);
  });
});

describe("SP-1 normalisation", () => {
  it("email lowercases and trims", () => {
    expect(normaliseEmail("  Jane@Example.COM  ")).toBe("jane@example.com");
    expect(normaliseEmail("")).toBeNull();
    expect(normaliseEmail(null)).toBeNull();
  });

  it("phone keeps digits only", () => {
    expect(normalisePhone("+61 (0) 400 123 456")).toBe("610400123456");
    expect(normalisePhone("0400-123-456")).toBe("0400123456");
    expect(normalisePhone(null)).toBeNull();
  });

  it("company name squeezes whitespace + strips punctuation", () => {
    expect(normaliseCompanyName("  Acme  Photography,  Inc.  ")).toBe(
      "acme photography inc",
    );
  });

  it("domain strips scheme + www + path", () => {
    expect(normaliseDomain("https://www.Example.com/about")).toBe(
      "example.com",
    );
    expect(normaliseDomain(null)).toBeNull();
  });
});
