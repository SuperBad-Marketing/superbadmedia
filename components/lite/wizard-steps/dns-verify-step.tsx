"use client";

/**
 * `dns-verify` step-type — displays expected DNS records + polls the vendor
 * or a DNS resolver at `wizards.dns_verify_poll_interval_ms` until every
 * expected record resolves, or times out at 10 minutes (hardcoded per spec
 * §4 — polling interval is the autonomy-sensitive knob, not the max).
 *
 * Non-resumable per spec §4.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  type StepComponentProps,
  type StepTypeDefinition,
  invalid,
} from "@/lib/wizards/step-types";

export type DnsRecord = {
  type: "A" | "CNAME" | "TXT" | "MX";
  name: string;
  value: string;
  verified: boolean;
};

export type DnsVerifyState = {
  records: DnsRecord[];
};

export type DnsVerifyConfig = {
  /** Injected from `settings.get('wizards.dns_verify_poll_interval_ms')`. */
  pollIntervalMs: number;
  /** Resolves every record's current status. Shell injects. */
  resolve: (records: DnsRecord[]) => Promise<DnsRecord[]>;
};

function DnsVerifyComponent({
  state,
  onChange,
  onNext,
  config,
}: StepComponentProps<DnsVerifyState>) {
  const cfg = config as DnsVerifyConfig | undefined;
  const allVerified =
    state.records.length > 0 && state.records.every((r) => r.verified);

  React.useEffect(() => {
    if (allVerified || !cfg?.resolve || !cfg.pollIntervalMs) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const next = await cfg.resolve(state.records);
      if (!cancelled) onChange({ records: next });
    };
    const id = setInterval(tick, cfg.pollIntervalMs);
    tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [allVerified, cfg, state.records, onChange]);

  return (
    <div data-wizard-step="dns-verify" className="space-y-4">
      <ul className="space-y-2">
        {state.records.map((r, i) => (
          <li
            key={`${r.type}-${r.name}-${i}`}
            data-wizard-dns-record
            data-verified={r.verified}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <span className="font-mono">
              {r.type} {r.name} → {r.value}
            </span>
            <span>{r.verified ? "✓" : "…"}</span>
          </li>
        ))}
      </ul>
      {allVerified ? (
        <Button type="button" onClick={onNext}>
          Continue
        </Button>
      ) : null}
    </div>
  );
}

export const dnsVerifyStep: StepTypeDefinition<DnsVerifyState> = {
  type: "dns-verify",
  resumableByDefault: false,
  Component: DnsVerifyComponent,
  resume: (raw) => {
    const r = (raw ?? {}) as Partial<DnsVerifyState>;
    return {
      records: Array.isArray(r.records) ? (r.records as DnsRecord[]) : [],
    };
  },
  validate: (state) =>
    state.records.length > 0 && state.records.every((r) => r.verified)
      ? { ok: true }
      : invalid("Some records haven&apos;t resolved yet."),
};
