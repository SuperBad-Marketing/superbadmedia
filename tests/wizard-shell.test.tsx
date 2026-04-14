/**
 * WizardShell chrome tests (SW-1).
 *
 * Server-renders the shell and asserts progress bar, cancel trigger, help
 * affordance, and expiry hint are present. No DOM (jsdom) environment —
 * uses renderToStaticMarkup + string matching, consistent with the
 * existing `tests/` convention (node env, no @testing-library).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { WizardShell } from "@/components/lite/wizard-shell";
import { killSwitches, resetKillSwitchesToDefaults } from "@/lib/kill-switches";

// SW-2 added `setup_wizards_enabled` — must be on for chrome tests below.
beforeAll(() => {
  killSwitches.setup_wizards_enabled = true;
});
afterAll(() => {
  resetKillSwitchesToDefaults();
});

const baseProps = {
  wizardKey: "stripe-admin",
  currentStep: 1,
  stepLabels: ["Create account", "Connect keys", "Test webhook", "Done"],
  audience: "admin" as const,
  expiryDays: 30,
  onCancel: () => {},
};

describe("<WizardShell>", () => {
  it("renders a progress bar with one segment per step", () => {
    const html = renderToStaticMarkup(
      <WizardShell {...baseProps}>
        <div data-testid="step-body">Step body here</div>
      </WizardShell>,
    );
    // Progress container + 4 segments
    expect(html).toContain('data-wizard-progress');
    const segments = html.match(/data-wizard-progress-segment/g) ?? [];
    expect(segments.length).toBe(4);
  });

  it("marks prior segments as done and the current as active", () => {
    const html = renderToStaticMarkup(
      <WizardShell {...baseProps}>
        <div />
      </WizardShell>,
    );
    expect(html).toMatch(/data-state="done"/);
    expect(html).toMatch(/data-state="active"/);
    expect(html).toMatch(/data-state="pending"/);
  });

  it("renders the cancel trigger", () => {
    const html = renderToStaticMarkup(
      <WizardShell {...baseProps}>
        <div />
      </WizardShell>,
    );
    expect(html).toContain("data-wizard-cancel-trigger");
    expect(html).toContain('aria-label="Cancel wizard"');
  });

  it("renders the help trigger only when help prop is provided", () => {
    const without = renderToStaticMarkup(
      <WizardShell {...baseProps}>
        <div />
      </WizardShell>,
    );
    expect(without).not.toContain("data-wizard-help-trigger");

    const withHelp = renderToStaticMarkup(
      <WizardShell {...baseProps} help={<div>Need a hand?</div>}>
        <div />
      </WizardShell>,
    );
    expect(withHelp).toContain("data-wizard-help-trigger");
  });

  it("surfaces the expiry hint from the expiryDays prop (no hardcoded literal)", () => {
    const html = renderToStaticMarkup(
      <WizardShell {...baseProps} expiryDays={45}>
        <div />
      </WizardShell>,
    );
    expect(html).toContain("45 days");
  });

  it("passes children through as the step body", () => {
    const html = renderToStaticMarkup(
      <WizardShell {...baseProps}>
        <div data-testid="custom-body">Paste your Stripe secret key</div>
      </WizardShell>,
    );
    expect(html).toContain("Paste your Stripe secret key");
  });

  it("tags the root with the wizard key + audience for test/hook lookup", () => {
    const html = renderToStaticMarkup(
      <WizardShell {...baseProps} wizardKey="resend" audience="client">
        <div />
      </WizardShell>,
    );
    expect(html).toContain('data-wizard-key="resend"');
    expect(html).toContain('data-audience="client"');
  });
});
