# QB-4a Handoff — Client Quote Page + View Tracking

## What was built
- `lib/quote-builder/view-tracking.ts` — `markQuoteViewed()` idempotent sent→viewed transition, logs `quote_viewed` activity, flips pending `quote_reminder_3d` to `skipped` via idempotency key.
- `lib/quote-builder/load-public-quote.ts` — loader returning `{quote, company, primaryContact, content, supersededByToken}` or null (drafts return null).
- `app/lite/quotes/[token]/page.tsx` — server component, status branching (sent/viewed → experience; expired/withdrawn/superseded/accepted → status card), server-side stale-expiry guard, noindex metadata.
- `app/lite/quotes/[token]/actions.ts` — `acceptQuoteAction()` stub (QB-4c will land real accept).
- `components/lite/quote-builder/quote-web-experience.tsx` — scroll-snap §4.3 page; `mode: "live" | "modal-preview"`; sticky stepper, brand-cream surface, ToS/privacy tickbox + Accept button (stub).
- `components/lite/quote-builder/quote-status-card.tsx` — expired/withdrawn/superseded/accepted variants.
- `send-quote-modal.tsx` — added `preview` prop, 2-col grid with QuoteWebExperience in modal-preview mode on the left.
- `quote-editor.tsx` — passes preview snapshot to send modal.
- `proxy.ts` — allowlisted `/lite/quotes/` in `isPublicRoute()` (clients are anonymous).
- `tests/qb4a-view-tracking.test.ts` — 5 tests, all green.

## Verification
- `npx tsc --noEmit`: clean.
- `npm test`: 551 passed (+5).
- Route probe: 307→500 after middleware patch (500 is missing quotes table on working dev.db; not a code issue). **Manual browser verify still owed** — requires running `scripts/dev-reset-and-seed.ts` which resets state; deferred.

## Carry-ins to QB-4b
- Intro-paragraph synthesis prompt + redraft action (Opus drift-checked).
- `qb3_apply_template_in_editor`, `qb3_template_usage_count`.
- **Owed:** send action should enqueue `quote_reminder_3d` task; currently mark-skipped is a no-op until that ships.

## Carry-ins to QB-4c
- Stripe Payment Intent route (`/api/quotes/[token]/payment-intent` — also needs proxy allowlist).
- Payment Element + Tier-2 morph (layoutId="quote-primary-action").
- legal_doc_versions enforcement on tickbox submit.
- Accept side effects: transitionDealStage → won, settle email, Stripe Subscription for retainer/mixed, sound:quote_accepted.
- Confirmation screen (spec Q16), webhook handlers.

## Notes
- Split QB-4 into a/b/c was a Claude call per `feedback_technical_decisions_claude_calls` + session discipline.
- BHS only on hero headline (closed list: `quote_page_hero` allowed).
