# SW-13 — Generic API-key wizard (multi-vendor) — Brief

> **Pre-compiled per AUTONOMY_PROTOCOL.md §G0 / §"Pre-compiled session briefs" + G11.b.**
> SW-12 landed the Twilio form-step wizard — the fourth and last single-vendor non-critical admin wizard. SW-13 ships the last row of spec §5.1: a **single parameterised `api-key-paste` WizardDefinition** serving OpenAI / Anthropic / SerpAPI / Remotion from one module.

---

## 1. Identity

- **Session id:** SW-13
- **Wave:** 4 — Setup Wizards
- **Type:** FEATURE
- **Model tier:** `/deep` (Opus). First N-vendors-from-one-def pattern + dispatcher abstraction refactor. Not Sonnet-safe.

## 2. Kickoff protocol

1. Read `sessions/sw-12-handoff.md` + `sessions/sw-11-handoff.md`.
2. Read `docs/specs/setup-wizards.md` §5.1 last row (generic API-key inventory) + §5.3 (`WizardDefinition` primitive).
3. Read `lib/wizards/defs/twilio.ts` + `.../resend.ts` (api-key-paste copy sources).
4. Read `app/lite/setup/admin/[key]/page.tsx` — the dispatcher SW-13 refactors.

## 3. Scope — generic API-key wizard

**The shape.** One `WizardDefinition` exported from `lib/wizards/defs/api-key.ts` with a `vendor` query-param that selects between four vendor profiles. The def composes `api-key-paste → review-and-confirm → celebration`. Each vendor profile carries its own verify-ping endpoint + Zod validator + voice copy + manifest binding.

**Vendor profiles (all in one module):**
- **OpenAI** — verify via `GET https://api.openai.com/v1/models` (bearer). Key format `sk-…`.
- **Anthropic** — verify via `POST https://api.anthropic.com/v1/messages` with min payload (bearer `x-api-key`). Key format `sk-ant-…`.
- **SerpAPI** — verify via `GET https://serpapi.com/account?api_key=<key>`.
- **Remotion** — verify via Remotion Lambda deploy-check or equivalent (spec §5.1 row to confirm).

**Routing.** `/lite/setup/admin/api-key?vendor=openai` picks the OpenAI profile. Vendor param validated server-side; unknown → 404. Each vendor registers its own row in `integration_connections` with its own `vendor_key` (not a shared `api-key` key).

## 4. Dispatcher abstraction — land it this session

SW-12 deferred this for the fourth time. SW-13 is the trigger. Two options:

- **Option A — `CLIENT_MAP: Record<WizardKey, (props) => ReactNode>`** with a narrow union of per-key props. Keeps the if-chain pattern's type safety.
- **Option B — key-to-client-component map** with a shared `AdminWizardClientProps` that all per-wizard clients accept; dispatcher stops computing authorize URLs (each client computes its own or gets them via a small per-key config). Cleaner; more surgery.

**Pick A unless B is obviously less code.** Goal is eliminating the if-chain, not redesigning client props.

## 5. File whitelist

- `lib/integrations/vendors/openai.ts`, `anthropic.ts`, `serpapi.ts`, `remotion.ts` — four vendor manifests.
- `lib/wizards/defs/api-key.ts` — single `WizardDefinition`; vendor selection via payload.vendor.
- `lib/wizards/defs/index.ts` — add one import.
- `app/lite/setup/admin/[key]/clients/api-key-client.tsx` — per-wizard client (generic; reads vendor from URL).
- `app/lite/setup/admin/[key]/page.tsx` — **refactor dispatcher to CLIENT_MAP** + add api-key branch that reads `?vendor=`.
- `app/lite/setup/admin/[key]/actions-api-key.ts` — vendor-param-aware action.
- `tests/api-key-wizard.test.ts` — 8–10 tests (def composition, each vendor's Zod accept/reject, live verify-rejection for one vendor, barrel registration asserts 8 wizards).
- `tests/e2e/admin-api-key-openai.spec.ts` — optional; `test.skip()` when `OPENAI_TEST_KEY` unset.
- `.env.example` — four new `*_TEST_KEY` vars.

## 6. Rollback strategy (G6)

- Feature-flag-gated via `setup_wizards_enabled`.
- Dispatcher refactor rollback: revert `page.tsx` to pre-refactor if-chain; per-wizard clients unchanged.
- No new schema; no new settings keys; no new callback routes (none of the four vendors use OAuth).

## 7. Definition of done

- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npm test` → 370+ green (362 prior + 8–10 new)
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean
- [ ] `npm run test:e2e` → 7 skipped (existing 6 + new api-key-openai)
- [ ] Dispatcher no longer has per-wizard if-chain
- [ ] Handoff written; tracker updated; SW-14 brief pre-compiled (or Wave 4 closure if SW-13 is the final wave-4 session)
- [ ] No PATCHES_OWED row opened (no callback skeletons)

## 8. Split-point (if context tight)

Four vendors + dispatcher refactor is the biggest session of Wave 4. Natural split points:

- **Option A — split by vendor count.** SW-13-a: def shape + OpenAI + Anthropic + dispatcher refactor. SW-13-b: SerpAPI + Remotion.
- **Option B — split by refactor.** SW-13-a: four vendors under the existing if-chain (fifth branch, ugly but ships). SW-13-b: refactor dispatcher to CLIENT_MAP alone. Option B loses the "land the abstraction this session" value.

**Default: ship whole if context allows; split Option A if not.**

## 9. Notes for the next-session brief writer

- **After SW-13, Wave 4 likely closes.** Setup Wizards wave completes its full §5.1 inventory. Next wave per BUILD_PLAN.md is whatever sits next in the sequence — confirm with `BUILD_PLAN.md` before drafting SW-14 / next-wave kickoff.
- **OAuth callback hardening trio (SW-7-b / SW-10-b / SW-11-b)** still owed. Best batched into a single session after Andy registers the three vendor apps. Flag for scheduling before Wave 5.
- **`wizard_progress` writer** unlanded through all of Wave 4. If SW-13 stays single-paste-per-vendor, writer is deferrable to a feature session that actually needs mid-flow persistence (likely CSV import or webhook probe, whichever lands first).
- **Shared OAuth E2E harness** — still non-owed; first vendor app registration is the pull.
- **`/lite/integrations` hub page** still unshipped; spec §8.4 implies it exists. Worth flagging as a Wave-4 closure gap.
- **LLM model registry contact point.** OpenAI and Anthropic API keys feed `lib/ai/models.ts`. Registry is already the source of truth for model IDs — SW-13 only wires credentials, not model selection. Cross-reference when documenting.
- **First wizard-def module that self-registers multiple `vendor_key`s.** Registry contract may need a per-vendor `getWizard('api-key', { vendor: 'openai' })` lookup or separate registry entries. Decide in SW-13.
