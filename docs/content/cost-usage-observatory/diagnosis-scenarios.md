# Cost & Usage Observatory — Diagnosis Prompt Calibration Scenarios

Content source for CUO spec §12 (diagnosis card hypothesis prompt calibration). 10 synthetic anomaly scenarios for tuning the Opus `diagnose-cost-anomaly.ts` prompt.

Each scenario includes: setup, expected hypothesis, expected confidence, expected recommended action. The build session uses these as a test harness — the diagnosis prompt must produce results consistent with each scenario's expected output.

---

## Scenario 1 — Prompt regression (classic)

**Setup:** `outreach-writer` average tokens per call doubled from 820 to 1,710 starting at 14:08 today. A deploy event landed at 14:02. Prompt version hash changed at 14:02.

**Expected hypothesis:** Prompt template regression from the 14:02 deploy. Input context grew — likely the full email thread is now being passed instead of just the subject line.

**Expected confidence:** High

**Expected action:** Investigate — review the prompt diff between the two version hashes.

---

## Scenario 2 — Loop detection

**Setup:** `inbox-classify-inbound-route` fired 340 calls in 5 minutes (normal rate: ~8/hour). All calls have the same `actor_id`. No deploy events in the last 24 hours.

**Expected hypothesis:** Classification loop — the same inbound message is being re-routed and re-classified repeatedly. Likely a retry mechanism that isn't recognising its own output.

**Expected confidence:** High

**Expected action:** Kill switch — stop the job immediately while the loop is investigated.

---

## Scenario 3 — Model upgrade (vendor price change)

**Setup:** `brand-dna-generate-prose-portrait` per-call cost jumped from $0.08 to $0.14 overnight. Call volume unchanged. No deploy events. No prompt version change. The jump aligns with a known Anthropic pricing update.

**Expected hypothesis:** Vendor pricing change. Per-token cost increased — call volume and token count are stable, but the pricing formula is now understating the new rate.

**Expected confidence:** Medium (diagnoser can't confirm external pricing changes, only correlate timing)

**Expected action:** Acknowledge — update the pricing formula in the registry to reflect the new rate.

---

## Scenario 4 — Legitimate data spike

**Setup:** `lead-gen-outreach-draft` daily spend is 4x normal. Call count is 4x normal. Per-call cost is stable. A new vertical onboarding batch of 200 prospects was imported yesterday.

**Expected hypothesis:** Outreach volume spike from a bulk prospect import. Per-call cost is normal — the increase is purely volume-driven.

**Expected confidence:** High

**Expected action:** Acknowledge — raise the daily ceiling if this import cadence will recur.

---

## Scenario 5 — Third-party price change (ambiguous)

**Setup:** `resend-send` per-call estimated cost jumped 30%. No change in call volume, content size, or deployment. No Resend pricing announcement visible.

**Expected hypothesis:** Possible Resend pricing change or billing tier transition. The cost formula may need recalibration.

**Expected confidence:** Low (no corroborating evidence — could be estimation drift, billing tier change, or actual price change)

**Expected action:** Investigate further — check Resend billing dashboard and reconcile.

---

## Scenario 6 — Warmup-fresh false positive

**Setup:** `hiring-candidate-score` triggered a learned-band anomaly after 8 days of history (just past the 7-day warmup). The p95 was computed from only 55 calls. A single expensive scoring run on a large portfolio skewed the band.

**Expected hypothesis:** Small-sample false positive. The learned band hasn't stabilised — a single outlier call is distorting the p95 with so few data points.

**Expected confidence:** Medium

**Expected action:** Acknowledge — suppress for 24h, revisit when the band has 200+ calls of history.

---

## Scenario 7 — Multi-job cascade

**Setup:** Three jobs spiked simultaneously: `content-generate-blog-post`, `content-generate-social-draft`, `content-select-visual-template`. All are Content Engine jobs. A scheduled content-generation batch ran at 03:00 and processed 3x the normal queue (backlog from a paused weekend).

**Expected hypothesis:** Cascading spike from Content Engine batch processing a weekend backlog. All three jobs are downstream of the same scheduled trigger. Per-call costs are normal — total spend is elevated because the queue was deeper than usual.

**Expected confidence:** High

**Expected action:** Acknowledge — the backlog is a one-off. No band adjustment needed unless pauses become regular.

---

## Scenario 8 — Silent governor (should NOT recommend throttle)

**Setup:** A Medium-tier subscriber's total attributed cost this month is 2.5x their subscription fee. The subscriber is active and using features normally.

**Expected hypothesis:** Subscriber is unprofitable at the current tier rate. This is a tier-design signal, not an operational anomaly.

**Expected confidence:** High

**Expected action:** Report to tier-health panel — this surfaces as a tier-level alert, not a per-subscriber intervention. No throttling, no capping, no silent governor.

---

## Scenario 9 — Deploy correlation with no prompt change

**Setup:** `cockpit-brief` per-call cost rose 40% starting 2 hours after a deploy. Prompt version hash did NOT change. Token count per call increased by ~35%.

**Expected hypothesis:** A non-prompt code change in the deploy altered the context bundle being passed to the brief generator. The prompt is the same, but it's receiving more input data — likely a new data source was added to the cockpit context assembly.

**Expected confidence:** Medium (correlates with deploy timing, but the prompt hash staying stable means the cause is upstream of the prompt)

**Expected action:** Investigate — review the deploy diff for changes to the cockpit context assembly.

---

## Scenario 10 — Diagnoser self-trigger

**Setup:** `observatory-diagnose-cost-anomaly` itself triggered a rate anomaly. 12 diagnosis calls fired in 10 minutes because a burst of anomalies from a batch processing run all created diagnosis tasks simultaneously.

**Expected hypothesis:** Diagnoser cascade — multiple simultaneous anomalies each triggered their own diagnosis call. The diagnoser's per-hour cap should prevent this, but the burst arrived faster than the cap could absorb.

**Expected confidence:** High

**Expected action:** Acknowledge — the burst is self-limiting (the anomalies that triggered it have already dedupe-collapsed). Verify the per-hour cap is functioning. Do not kill-switch the diagnoser unless the cascade is still growing.
