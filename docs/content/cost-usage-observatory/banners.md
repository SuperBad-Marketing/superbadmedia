# Cost & Usage Observatory — Banner Copy

Content source for CUO spec §3.3 (anomaly banners), §3.5 (threshold/projection banners), §5.1 (kill-switch UI).

All banner copy follows the spec's voice posture: dry house voice at low/mid, terse and flat at severe. Numbers are always the content; voice is only the frame.

---

## Tier-low banner bodies (~10 variants)

Stratified by job family. Each variant uses `{job}`, `{observed}`, `{band}` as interpolation tokens.

### LLM family

1. "{job} had a big day. ${observed} yesterday against ${band}-ish normal. Worth a look."
2. "{job} is running warm. ${observed} over the last 24 hours — usual neighbourhood is ${band}."
3. "{job} spent more than usual. ${observed} against a ${band} baseline. Probably fine."
4. "{job} drifted. ${observed} vs the ${band} band. Nothing urgent — just flagging."

### Payments family

5. "Stripe calls via {job} ran higher than usual. ${observed} against ${band} baseline."
6. "{job} logged ${observed} in payment processing. Typical band is ${band}."

### Comms family (email / SMS / Graph)

7. "{job} sent more than expected. ${observed} against the ${band} normal."
8. "Email volume through {job} drifted. ${observed} vs ${band}. Worth a glance."

### Media rendering family

9. "{job} render costs hit ${observed}. Usual band sits around ${band}."
10. "Rendering through {job} ran warm. ${observed} against ${band}."

---

## Tier-mid banner bodies (~8 variants)

Neutral-louder. Prominent numbers. No punchlines. Include the multiplier.

### LLM family

1. "{job} spent ${observed} in the last 24 hours. Usual band is ${band}. {multiplier}x over."
2. "{job} is ${multiplier}x above normal. ${observed} against a ${band} baseline. Take a look."
3. "${observed} on {job} today. That's ${multiplier}x the usual ${band}. Investigate or acknowledge."

### Payments family

4. "Stripe processing via {job}: ${observed} against ${band} expected. {multiplier}x drift."
5. "{job} payment volume is ${multiplier}x above band. ${observed} today vs ${band} normal."

### Comms family

6. "{job} comms spend hit ${observed}. That's ${multiplier}x the ${band} baseline."
7. "Email/SMS through {job}: ${observed} today. Band is ${band}. {multiplier}x over."

### Media rendering family

8. "{job} rendering: ${observed} against ${band}. {multiplier}x above band."

---

## Tier-severe banner bodies (~5 variants)

Terse. Flat. No voice. Red treatment. Zero decoration.

1. "Hard ceiling breached. {job}: ${observed} today vs ${ceiling} ceiling."
2. "Rate limit triggered. {job}: {rate} calls in {window}. Possible loop."
3. "Daily ceiling exceeded. {job}: ${observed} against ${ceiling} daily cap."
4. "Per-call ceiling breached. {job}: ${observed} single call vs ${ceiling} max."
5. "{job} flagged. ${observed} in {window}. {multiplier}x over. Action required."

---

## Threshold-crossed banner copy

For monthly-spend thresholds (spec §3.5, §9 Q9).

**MTD threshold crossed:**
- "Monthly spend crossed ${threshold}. Currently at ${mtd}. You set this flag."
- "You're past ${threshold} for the month. ${mtd} total. The next flag is at ${next_threshold}."

**Projection threshold crossed:**
- "At current pace you'll land around ${projected} this month. You set a flag at ${threshold}."
- "Run rate puts the month at ${projected}. That crosses your ${threshold} marker."
- "Linear projection: ${projected} by month-end. ${threshold} threshold will be passed."

---

## Tier-health banners (spec §5.2)

**Tier structurally underwater:**
- "{tier_name} tier has {percent}% of subscribers underwater this month. The tier design may need restructuring."
- "{percent}% of {tier_name} subscribers are costing more than they pay. Tier-level fix, not a subscriber problem."

---

## Unknown-job banner (spec §4.2)

- "Unregistered job '{job_key}' logged a call. It's in the ledger but has no bands. Register it."

---

## Kill-switch confirmation modal copy (spec §3.3)

**Disable:**
- "Disable {job}. Nothing will call it until you re-enable. Confirm."
- "Kill {job}. All calls return a typed error until you bring it back."

**Resume:**
- "Bringing {job} back. Last spike was {hours_ago} hours ago."
- "Re-enabling {job}. It's been off since {disabled_at}."

---

## Acknowledge & suppress copy

- "Acknowledged. This anomaly won't re-banner for 24 hours."
- "Noted. Suppressed until {suppress_until}."
