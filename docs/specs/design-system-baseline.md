# Spec — Design System Baseline

**Phase 3 · Session 1**
**Locked:** 2026-04-11
**Status:** Final
**Type:** Cross-cutting reference (not a product feature)

This is the canonical reference document every later spec points at when describing UI, motion, sound, or brand-load-bearing aesthetic choices. It extends the locked `superbad-visual-identity` skill and `FOUNDATIONS.md §9–§10` into a working CRM design system. It does not replace either — it sits on top of both as the application-layer translation.

---

## User story

A future build session — or a future feature spec — needs one place to look up tokens, primitives, motion vocab, sound registry, and brand-load-bearing rules. They open this file. They get exact values, an exact component primitive list, an exact closed list of every "scarce" usage rule, and an exact data model for the user-facing customisation surface. They can ship a feature without re-deciding a single design question.

The "user" of this doc is **the next build session**, not an end-user. The success of this spec is measured by how often a later spec or build session has to invent or argue about a design value. The right answer is *never*.

---

## Brand spine (locked, never altered by any preset)

These are the load-bearing brand elements. They are the same in every theme preset, every typeface preset, and every density preset. Touching them requires going back to FOUNDATIONS, not editing this spec.

- **Display face:** Black Han Sans — used only in the 8 closed locations below.
- **Label face:** Righteous — eyebrows, micro-UI, uppercase tab/section labels.
- **Logo face:** Pacifico — wordmark only.
- **Surface strategy:** stacked warm tints with soft inner highlights, no shadows.
- **Mode:** dark only. No light variant in v1, ever.
- **Iconography family:** Lucide, outline only.
- **Component primitive layer:** shadcn/ui (Radix + Tailwind), copy-pasted into the repo.
- **Motion library:** Framer Motion.
- **Sound library:** `use-sound` (Howler.js under the hood).

---

## Surface strategy

Surfaces in Lite differentiate from each other by **slightly lighter warm tints** of the base charcoal, plus a **near-invisible top inner highlight** suggesting the surface is catching light from above. No shadows. No bordered cards as the default — borders appear only as a *secondary* separator on high-density tables (inbox row dividers, pipeline list views).

The visual feel target: late-afternoon sun through a wood-panel office. Warm. Tactile. Layered. Physical. Never sterile, never tech-modernist.

**Per-elevation tint values** (locked):

```css
--surface-0:   var(--neutral-900);  /* canvas — body background */
--surface-1:   var(--neutral-800);  /* default elevated surface — cards, sidebars, inputs */
--surface-2:   var(--neutral-700);  /* second elevation — modals, popovers, dropdowns */
--surface-3:   var(--neutral-600);  /* hover lift on top of surface-2 */
```

**Inner highlight pattern** (applied to every elevated surface):

```css
box-shadow: inset 0 1px 0 rgba(253, 245, 230, 0.04);
```

`rgba(253, 245, 230, …)` is the brand cream at very low opacity — it's catching cream-coloured light, not white.

---

## Colour tokens

### Brand tokens (locked from FOUNDATIONS §9, never override)

```css
--brand-red:      #B22848;
--brand-cream:    #FDF5E6;
--brand-pink:     #F4A0B0;
--brand-orange:   #F28C52;
--brand-charcoal: #1A1A18;
```

### Extended warm-neutral scale (8 steps)

Warm-biased throughout — slight red/brown undertone, never a hint of blue. These are the dominant colours in the entire app (~75% of every screen by ratio, per FOUNDATIONS §9 product colour ratio).

```css
--neutral-950: #0F0F0E;  /* wells, deep insets, never used as a default canvas */
--neutral-900: #1A1A18;  /* canvas base — same hex as --brand-charcoal */
--neutral-800: #22221F;  /* surface-1 — default elevated surface tint */
--neutral-700: #2C2C28;  /* surface-2 — modal/popover tint */
--neutral-600: #3D3D37;  /* hover lift, hairline borders, dividers */
--neutral-500: #807F73;  /* muted text — placeholders, helper text, disabled labels */
--neutral-300: #D4D2C2;  /* primary body text (DM Sans default colour) */
--neutral-100: #FDF5E6;  /* high-emphasis text, headings — same hex as --brand-cream */
```

### Semantic tokens

```css
--success: #7BAE7E;          /* derived warm sage — never Material green, never tech-blue */
--warning: var(--brand-orange);
--error:   var(--brand-red);
--info:    var(--neutral-300); /* doubles up with body text — info doesn't need its own hue */
```

### Accent semantic deployment (Q10)

Each colour has a clearly defined job. No colour appears outside its job.

| Colour | Job | Where it shows up |
|---|---|---|
| **Red** (`--brand-red`) | Primary CTA + error state | Maximum **one** primary CTA per screen. Error toast / form error. Never decorative. |
| **Cream** (`--brand-cream` / `--neutral-100`) | High-emphasis text + brand highlight | Headings, hero text, callouts. Default text is `--neutral-300`, not cream. |
| **Charcoal** (`--brand-charcoal` / `--neutral-900`) | Canvas, surface tints, dominant ~75% of screen | Everywhere structural. |
| **Pink** (`--brand-pink`) | **Customer warmth + focus indicator** | Customer-facing surfaces only (client portal welcome, SaaS dashboard hero, first-ever-login overlay, customer email templates). 2px focus ring across the entire app. **Almost never appears in admin daily-use chrome.** |
| **Orange** (`--brand-orange`) | Warning state | Form warnings, dunning notices, "subscription failing" alerts, attention-needed badges. Not decorative. |
| **Sage green** (`--success`) | Success state | Successful save toast, "delivered" status, paid invoice indicator. Subtle, never celebratory — celebration is Tier 2 motion territory. |

---

## Typography

### Type roles (locked from FOUNDATIONS §9, expanded)

| Role | Default font | Used for |
|---|---|---|
| Display | Black Han Sans | The 8 closed locations only (see "Black Han Sans closed list" below) |
| Label | Righteous | Uppercase eyebrows, section labels, tab labels, table column headers, micro-UI |
| Body | DM Sans (varies by typeface preset) | Body copy, table cells, form fields, inbox previews, 95% of practical UI |
| Narrative | Playfair Display italic (varies by typeface preset) | Morning brief paragraph, "Lite talking to you in prose" moments |
| Logo | Pacifico | Wordmark only (sidebar top, marketing surfaces) |

### Type size scale (8 sizes)

```css
--text-display:   64px / 1.0;  /* Black Han Sans hero — marketing landing only */
--text-h1:        40px / 1.1;  /* Black Han Sans — page heroes in the 8 closed locations */
--text-h2:        28px / 1.2;  /* DM Sans semibold — admin page headers */
--text-h3:        20px / 1.3;  /* DM Sans semibold — section headers */
--text-body:      16px / 1.5;  /* DM Sans regular — default body */
--text-small:     14px / 1.5;  /* DM Sans regular — secondary text */
--text-micro:     12px / 1.4;  /* Righteous uppercase — eyebrows, labels, column headers */
--text-narrative: 24px / 1.5 italic; /* Playfair italic — morning brief, narrative moments */
```

**Density-compact override** (Q4): `--text-body` becomes 14px, `--text-h2` becomes 24px. Other sizes unchanged.

**Text-size-large override** (Q7 accessibility toggle): `--text-body` becomes 18px, `--text-small` becomes 16px. `--text-h1` and `--text-display` are unchanged (they scale with viewport).

### Black Han Sans closed list (Q6)

Black Han Sans appears in **exactly these 8 locations** across the entire app. Anywhere else, the rule violates the brand and the build session is wrong. Adding a 9th location requires explicit Andy approval, captured in this spec.

1. Marketing landing page hero (Lite-hosted, post-GHL).
2. Morning brief headline / day eyebrow (above the narrative paragraph).
3. Quote page hero (prospect's company name or "Welcome, [Name]").
4. SaaS customer dashboard welcome hero.
5. Client portal welcome hero.
6. Empty state hero text ("No leads yet.", "Inbox clear. Suspicious.", etc.).
7. Tier 2 arrival reveal text ("Welcome aboard", "First client. Don't fuck it up.", milestone overlays).
8. Setup wizard intro screen + completion screen (entry and exit only — not every step).

Every other H1 in Lite — admin page headers, settings pages, modal titles, table headers — uses **DM Sans semibold at `--text-h2`**, not Black Han Sans.

---

## Spacing scale

Tailwind's default 4px base, exposed as named tokens.

```css
--space-1: 4px;   /* 0.25rem — hairline gaps */
--space-2: 8px;   /* 0.5rem  — tight padding, icon-to-text gaps */
--space-3: 12px;  /* 0.75rem — input internal padding */
--space-4: 16px;  /* 1rem    — default padding, form field gaps */
--space-5: 24px;  /* 1.5rem  — card padding, section gaps */
--space-6: 32px;  /* 2rem    — page padding, major section gaps */
--space-7: 48px;  /* 3rem    — brand-surface padding (airy density) */
--space-8: 64px;  /* 4rem    — hero padding */
```

---

## Corner radius (Q5)

Three locked tokens, mapped to purpose not size.

```css
--radius-tight:    4px;  /* buttons, inputs, badges, chips, small interactive bits */
--radius-default:  8px;  /* cards, modals, dropdowns, panels — everything elevated */
--radius-generous: 16px; /* CLOSED LIST — see below */
```

**`--radius-generous` closed list:**
1. Quote page hero card.
2. Morning brief panel.
3. SaaS customer dashboard hero card.
4. Client portal welcome panel.

Adding a 5th surface to this list requires explicit Andy approval.

---

## Density (Q4)

Two presets. Applied at the page layout level, never per-component. Every feature spec must declare which preset its screens use.

| Preset | Where it's used | Padding scale | Body size |
|---|---|---|---|
| **`density-comfort`** | Admin work surfaces (pipeline, inbox, client list, cockpit, settings, products admin) | Default `--space-*` values | `--text-body` 16px |
| **`density-air`** | Brand/customer surfaces (quote page, morning brief, client portal, SaaS dashboard, marketing landing, all wizard intros + completion screens) | Bumped one step (everything that was `--space-4` becomes `--space-5`, etc.) | `--text-body` 16px (unchanged) |

The user-facing **density preference toggle** (Q7) further adds an admin-only `density-compact` variant — same padding as `density-comfort` minus one step, body type drops to 14px. Brand surfaces are never compact regardless of toggle.

---

## Motion (Q2 + Q3)

### Tier 1 — Interaction (house spring)

Every interactive transition in the app uses the same Framer Motion spring as its default. Codified once, referenced by name everywhere.

```ts
// lib/motion.ts
export const houseSpring = {
  type: 'spring',
  mass: 1,
  stiffness: 220,
  damping: 25,
} as const;
```

Effective duration: ~280ms with a whisker of overshoot. Used on: clicks, hovers, drags, modal opens, drawer slides, toast arrivals, Kanban card drops, tab switches, dropdowns, tooltips, popovers, every default `motion.div` in the app.

### Tier 2 — Arrival (choreographed)

Reserved for the closed list below. Each moment has its own named choreography. Anything not on this list uses Tier 1 — no exceptions, no drive-by additions.

**Tier 2 closed list:**

1. **First dashboard load after login.** Sidebar, topbar, main content stagger in over ~400ms total. Once per session.
2. **Morning brief opens each day.** Playfair Display narrative paragraph fades in as a single block over ~800ms with a custom slow-out cubic-bezier (`cubic-bezier(0.16, 1, 0.3, 1)`). Once per day. Paired with the **morning brief** sound.
3. **Quote accepted (customer side, on quote page).** Warm pulse across the surface, glow bloom, the **quote accepted** sound, the Accept button transforms into a "Welcome aboard" state. ~1.2s total. Single most brand-critical moment in the app.
4. **Stripe subscription activated (admin side, watching the Kanban).** Deal card lifts out of Negotiating, drifts across to Won, graduates into a client card with a warm colour shift. ~1s total. Paired with the **subscription activated** sound.
5. **Setup wizard completion (any wizard, any role).** Final step: wizard panel warm-pulses, short reward choreography plays, panel resolves into the user's previous context. **Silent** (no sound — registry is full).
6. **Portal first-ever load.** Both client portal AND SaaS customer dashboard. Tracked via `first_seen_at` timestamp on the relationship record. Chrome fades in with the user's name prominent. Subsequent loads use Tier 1.
7. **Inbox zero.** Inbox transitions from ≥1 message to 0 — last message card shrinks out, empty state fades in with a dry SuperBad-voice line. ~600ms. Silent.

**Tier 2 conditional overlays** (extend an existing Tier 2 moment, do not add new ones):

- **Revenue milestone wash on #4.** When a Stripe subscription activation crosses a locked threshold (first client ever, first $5k MRR, first $10k MRR, first $25k MRR — locked closed list), #4 extends by ~800ms with a warm wash across the whole Kanban surface. The next morning brief also gets milestone copy.
- **First-ever sign-in on #1.** First time a user *ever* signs in (any role) — tracked via `first_signed_in_at` timestamp on the user record — #1 extends with an additional welcome layer over the standard staggered reveal. Subsequent sessions use the standard #1.

### Reduced motion behaviour (Q7 accessibility toggle)

- **Motion = Full** (default): everything as specified above.
- **Motion = Reduced**: Tier 2 cinematic moments are replaced with their Tier 1 equivalents. House spring is replaced with a 180ms linear ease-out. No staggered reveals.
- **Motion = Off**: all transitions become instant *except* modal opens (which still fade over 100ms for context — instant modal swaps are disorienting).

OS-level `prefers-reduced-motion: reduce` automatically maps to **Motion = Reduced** unless the user has explicitly set their preference in Settings → Display.

---

## Sound (FOUNDATIONS §10 + per-sound character details)

The sound registry is **locked at 7 sounds**. Adding an 8th requires explicit Andy approval. The locked registry:

| # | Sound key | Character | Duration | Pairs with |
|---|---|---|---|---|
| 1 | `quote-accepted` | Celebratory chime, warm wooden mallet, single tone, slight reverb tail | ~600ms | Tier 2 #3 |
| 2 | `subscription-activated` | Sister chime to #1 — same character, different note | ~600ms | Tier 2 #4 |
| 3 | `kanban-drop` | Soft tactile thunk, wooden, low-mid frequency, no reverb. Like a wooden chip on felt. | ~80ms attack, ~200ms decay | Tier 1 (Kanban interaction) |
| 4 | `morning-brief` | Single warm bell tone, long decay | ~1.2s | Tier 2 #2 |
| 5 | `inbox-arrival` | Gentle warm pop, soft attack, no reverb, mid-frequency | ~150ms | Inbox new message (Tier 1) |
| 6 | `deliverable-complete` | Subtle ascending two-note (C–E or similar), quiet, satisfying | ~400ms | Deliverable status change to "complete" (Tier 1) |
| 7 | `error` | Low warm thud, low frequency, warm wooden character. Respectful failure, never harsh. | ~250ms | Error toast / form error |

**What is silent:**
- All hovers
- All button clicks (except where listed)
- Modal open / close
- Tab switch
- Dropdown open
- Drawer slide
- Wizard step transitions (and wizard completion — Tier 2 #5 is silent)
- Inbox zero (Tier 2 #7 — silent)

**Sourcing:** per FOUNDATIONS §10. Freesound API + optional ElevenLabs sound effects API. Andy reviews 2–3 candidates per sound via a small "sound review" admin page (built in Phase 5). No manual media authoring required.

**Implementation:** typed registry at `lib/sounds.ts`. No string-literal sound keys anywhere else. `soundsEnabled` field on user table (default true). Settings → Display toggle. Respects `prefers-reduced-motion: reduce` (mutes when set). All sound files self-hosted from `/public/sounds/approved/`. Licensing logged in `docs/sound-attributions.md`.

---

## Iconography (Q11)

- **Library:** Lucide (already a shadcn dependency).
- **Style:** outline only. No filled variants.
- **Sizes:** three only — `16px` micro, `20px` default, `24px` accent.
- **Used for:** sidebar nav items, primary action buttons, table row actions, status indicators (alongside text labels), wizard step markers.
- **Not used for:** decoration, headings, body copy, every-label-needs-an-icon syndrome, replacing text labels in nav.
- **Stroke width:** Lucide default (1.5px). Harmonises with DM Sans.
- **Colour:** inherits `currentColor`. Default colour is `--neutral-300`. Active/hover states inherit from the parent component's state colour.

---

## Form patterns (Q12)

- **Label position:** above the input. Never inline-left.
- **Helper text:** below the input, in `--neutral-500`, `--text-small`.
- **Error state:** error message below the input in `--error`, `--text-small`. Input border switches to `--error`. No icon, no shake animation.
- **Required field marker:** small red dot (`--error`, 6px circle) after the label text. Not an asterisk.
- **Default layout:** single column. Two-column only when fields are obviously paired (first/last name, city/postcode, start/end date).
- **Multi-step forms:** always go through the wizard pattern (separate spec). Never a single page with collapsed sections.
- **Submit button:** bottom of form, full-width on mobile, right-aligned on desktop. Always the **only** primary CTA on the screen (per the one-red-CTA rule).

---

## Focus + interaction states (Q13)

- **Focus ring:** `2px solid var(--brand-pink)` with a `2px` offset gap from the focused element.
- **Why pink:** pink never appears in admin chrome under the accent deployment rules (Q10), so a pink focus ring always reads as "this element has focus" with zero ambiguity. It also ties to pink's customer-warmth role — focus = "we see you".
- **Hover state:** +6% lighten on the surface tint. Subtle. Never a glow, never a colour shift, never a blue overlay.
- **Active / pressed state:** -4% darken plus a 1px inward shift (a `transform: translateY(1px)`) to feel pressed.
- **Disabled state:** 40% opacity, no colour change, `cursor: not-allowed`.
- **Loading state:** in-button spinner replaces the button label, button width preserved (no layout shift).

---

## Admin shell layout (Q9)

The chrome of every admin page (`/lite`, `/lite/pipeline`, `/lite/inbox`, `/lite/clients`, `/lite/products`, `/lite/cockpit`, `/lite/settings`).

**Structure:**
- **Persistent left sidebar**, ~240px wide, full height. Never collapses to an icon rail. Sidebar contains:
  - SuperBad wordmark (Pacifico) at the top, as a Link to `/lite`.
  - Primary nav items (Cockpit / Pipeline / Inbox / Clients / Products / Settings) — Lucide icon `20px` + DM Sans `--text-body`. Active state = pink left border + cream text.
  - Andy's profile chip at the bottom (avatar + name + role badge), clickable to settings.
- **Main content area**, fills the remaining viewport. Padding = `--space-6` (32px) on all sides. Max content width: none (CRM benefits from full-bleed; specific specs may constrain).
- **No top bar** by default. Page-level actions live inside the main content area at the top of the page, next to the page H1.

**Per-page secondary panes:** some pages add a secondary in-content list pane (Inbox: message list + reader, Client detail: client list + detail). These are **per-spec decisions**, declared in the relevant feature spec, not in the global shell.

**Mobile:** admin is desktop-first. Responsive collapsing of the sidebar to a top-bar drawer is in scope but Andy is desktop-mouse-first, so this is a low-priority Phase 5 polish task. Client portals and SaaS customer dashboards are mobile-first separately and use their own shell.

---

## Theme presets (Q7)

Locked closed list of 3 hand-tuned, brand-canonical theme variants. Each preset is a CSS variable override applied at the root via a class on `<html>`. Switching presets swaps a small number of token values; everything else stays identical.

### `theme-standard` (default)

No overrides. Uses every token as defined above. The brand at its loudest. Charcoal-dominant, SuperBad Red as the single primary CTA, pink and orange as accent mutters.

### `theme-late-shift`

Warmer, slightly redder base. Pink promoted from "customer-warmth-only" to the primary CTA colour (which **reduces** the visual volume of red across the screen overall, since red retains only its error role). Subtler highlights. The "it's 11pm and you're still in the inbox" version. Reduces eye fatigue.

```css
.theme-late-shift {
  --neutral-900: #1F1A1A;        /* warmer/redder canvas */
  --brand-charcoal: #1F1A1A;
  --neutral-800: #27201F;
  --neutral-700: #312826;
  --accent-cta: var(--brand-pink); /* was: var(--brand-red) */
  --highlight-opacity: 0.025;     /* reduced from 0.04 */
}
```

### `theme-quiet-hours`

Desaturated and cream-forward. Red is muted to a deeper rust shade as the primary CTA. Pink and orange are nearly absent. Cream is promoted to a more prominent role. The "I need to focus and the brand is being a bit much today" version. Still unmistakably SuperBad — just whispered.

```css
.theme-quiet-hours {
  --brand-red: #8C2236;            /* deeper rust */
  --accent-cta: #8C2236;
  --brand-pink-opacity: 0.5;       /* halved wherever pink appears */
  --brand-orange-opacity: 0.5;
  --neutral-300: #DDDBC9;          /* slightly brighter body text */
}
```

**Per-role visibility:** all 3 presets are exposed to admin, clients, and SaaS customers. A SaaS customer's pick applies only to their dashboard; a client's pick applies only to their portal. They do not bleed into admin.

---

## Typeface presets (Q8)

Locked closed list of 3 hand-tuned typeface variants. Each preset swaps the **body face** and the **narrative face** only. Display (Black Han Sans), label (Righteous), and logo (Pacifico) are **never altered** across presets.

### `typeface-house` (default)

| Role | Font |
|---|---|
| Body | DM Sans |
| Narrative | Playfair Display italic |

Modern humanist body, high-contrast didone narrative. The standard SuperBad voice on screen.

### `typeface-long-read`

| Role | Font |
|---|---|
| Body | Plus Jakarta Sans |
| Narrative | Cormorant Garamond italic |

Body becomes a touch more humanist and softer. Narrative becomes more classical and bookish. The "settle in, this morning brief is going to be a slow read" version. Pairs especially well with `theme-quiet-hours`.

### `typeface-dispatch`

| Role | Font |
|---|---|
| Body | General Sans |
| Narrative | DM Serif Display italic |

Body becomes slightly more retro and character-forward. Narrative becomes more modern-magazine and ties to the body via the DM family. The "broadsheet, dry observational column" version. Pairs especially well with `theme-late-shift`.

**All fonts loaded via `next/font/google` with `display: swap`.** Only the user's selected preset's fonts load — not all three bundles. Cookie-based preset detection on the server, no extra page weight from unselected bundles.

**Theme × typeface independence:** the two preset axes are independent. 3 themes × 3 typefaces = 9 valid combinations, all guaranteed on-brand by construction (every individual preset is brand-true, so every pairing is brand-true).

---

## Settings → Display panel (Q7 + Q8)

The user-facing customisation surface. Total: **6 controls.** Locked closed list — additions require explicit Andy approval, treated with the same scarcity discipline as Tier 2 motion or the BHS closed list.

### Toggles

1. **Sounds.** On (default) / Off. Stored as `users.sounds_enabled`.
2. **Motion.** Full (default) / Reduced / Off. Stored as `users.motion_preference`. OS `prefers-reduced-motion: reduce` maps to "Reduced" if the user hasn't explicitly chosen.
3. **Density.** Comfort (default) / Compact. **Admin role only — hidden in the panel for client and customer roles.** Stored as `users.density_preference`.
4. **Text size.** Standard (default) / Large. Stored as `users.text_size_preference`.

### Presets

5. **Theme preset.** Standard (default) / Late Shift / Quiet Hours. Stored as `users.theme_preset`.
6. **Typeface preset.** House (default) / Long Read / Dispatch. Stored as `users.typeface_preset`.

### Per-role visibility

| Setting | Admin | Client | SaaS Customer |
|---|---|---|---|
| Sounds | ✓ | ✓ | ✓ |
| Motion | ✓ | ✓ | ✓ |
| Density | ✓ | — | — |
| Text size | ✓ | ✓ | ✓ |
| Theme preset | ✓ | ✓ | ✓ |
| Typeface preset | ✓ | ✓ | ✓ |

### Explicitly NOT in the panel (locked never-toggles)

- Custom hex colour picker / colour input
- Light mode toggle (dark only — locked)
- Custom font dropdown / font upload
- Per-component density override
- Sidebar position / layout direction
- Adding presets at runtime (closed list)

---

## Component primitive inventory

The following shadcn/ui components are copied into `components/ui/` during the first Phase 5 UI build session. This is the locked v1 set — anything not on this list requires a feature spec to justify it.

**Form primitives:**
`Button`, `Input`, `Label`, `Textarea`, `Select`, `Checkbox`, `Switch`, `RadioGroup`, `Form` (react-hook-form integration)

**Surface primitives:**
`Card`, `Dialog`, `Sheet`, `Drawer`, `Popover`, `Tooltip`, `DropdownMenu`, `ContextMenu`, `HoverCard`, `AlertDialog`

**Navigation + grouping:**
`Tabs`, `Accordion`, `Collapsible`, `Separator`, `ScrollArea`

**Feedback + status:**
`Toast` (via Sonner), `Avatar`, `Badge`, `Skeleton`, `Progress`

**Data:**
`Table`, `DataTable` (TanStack Table v8 wrapper)

**Search + commands:**
`Command` (cmdk)

**Date:**
`Calendar`, `DatePicker`

### Custom Lite primitives (not from shadcn)

Built fresh in Phase 5 sessions, inheriting tokens from this spec.

| Primitive | Purpose | Built in |
|---|---|---|
| `AdminShell` | Sidebar + main layout (Q9) | First UI session |
| `PortalShell` | Client portal chrome (mobile-first) | Client portal spec session |
| `DashboardShell` | SaaS customer dashboard chrome (mobile-first) | SaaS dashboard spec session |
| `WizardShell` | Setup wizard pattern (per FOUNDATIONS + memory) | Setup wizards spec session |
| `KanbanBoard` | Deal cards, drag-and-drop, stage transitions | Sales pipeline spec session |
| `BrandHero` | Black Han Sans hero text wrapper for the 8 closed locations | First UI session |
| `MorningBrief` | Playfair narrative renderer with Tier 2 motion + sound | Cockpit spec session |
| `ToastWithSound` | Sonner extension that plays from the locked sound registry | First UI session |
| `SoundProvider` | `use-sound` context, reads `users.sounds_enabled` | First UI session |
| `MotionProvider` | Framer Motion config, reads `users.motion_preference` | First UI session |
| `ThemeProvider` | Reads `users.theme_preset`, applies CSS class to `<html>` | First UI session |
| `TypefaceProvider` | Reads `users.typeface_preset`, loads correct `next/font` bundle | First UI session |
| `EmptyState` | Empty state pattern with BHS hero + dry SuperBad voice copy | First UI session |
| `Tier2Reveal` | Choreographed entrance wrapper for the closed Tier 2 list | First UI session |

---

## Data model

Fields and tables required by this spec, to be added to the Drizzle schema in the first Phase 5 build session.

### `users` table — preference fields

```ts
soundsEnabled:        boolean('sounds_enabled').default(true).notNull(),
motionPreference:     text('motion_preference', { enum: ['full', 'reduced', 'off'] }).default('full').notNull(),
densityPreference:    text('density_preference', { enum: ['comfort', 'compact'] }).default('comfort').notNull(),
textSizePreference:   text('text_size_preference', { enum: ['standard', 'large'] }).default('standard').notNull(),
themePreset:          text('theme_preset', { enum: ['standard', 'late_shift', 'quiet_hours'] }).default('standard').notNull(),
typefacePreset:       text('typeface_preset', { enum: ['house', 'long_read', 'dispatch'] }).default('house').notNull(),
firstSignedInAt:      integer('first_signed_in_at', { mode: 'timestamp' }), // nullable — set on first ever sign-in for Tier 2 #1 overlay
```

### Relationship-level "first seen" timestamps (for Tier 2 #6)

```ts
// client_relationships table
firstSeenAt: integer('first_seen_at', { mode: 'timestamp' }), // nullable

// saas_subscriptions table
firstSeenAt: integer('first_seen_at', { mode: 'timestamp' }), // nullable
```

### `revenue_milestones` table (for Tier 2 #4 milestone overlay)

```ts
export const revenueMilestones = sqliteTable('revenue_milestones', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  threshold: text('threshold').notNull(), // 'first_client', 'mrr_5k', 'mrr_10k', 'mrr_25k'
  crossedAt: integer('crossed_at', { mode: 'timestamp' }).notNull(),
});
```

The threshold list is itself a closed list — additions require explicit Andy approval and a code change.

### Token storage

Tokens live in **three places**, kept in sync:

1. **`app/globals.css`** — CSS custom properties (the canonical source).
2. **`tailwind.config.ts`** — `theme.extend.colors` etc., reading the CSS variables (so Tailwind utility classes work).
3. **`lib/design-tokens.ts`** — TypeScript export for runtime access (Framer Motion springs, sound registry, motion choreography).

If a token changes, all three update. The first Phase 5 UI session sets up the sync pattern and a typecheck-time guard (a unit test that asserts all three are aligned).

---

## Integrations

This spec doesn't ship integrations directly, but it constrains how later specs use them.

| Integration | Constraint from this spec |
|---|---|
| `next/font/google` | Fonts loaded per typeface preset, server-cookie-based bundle selection |
| Framer Motion | All interactive transitions use `houseSpring`. Tier 2 uses named choreographies from `lib/motion.ts`. |
| `use-sound` (Howler.js) | Plays only from the locked 7-sound registry. No string-literal sound keys outside `lib/sounds.ts`. |
| Tailwind v4 | Theme extends from CSS variables only. No raw hex literals in component code. |
| shadcn/ui + Radix | Component primitives copy-pasted into `components/ui/`. Never installed as a dependency. Theme variables map to brand tokens. |
| React Email (Resend templates) | Email templates inherit colour and typography tokens via inline-styled token references — same brand spine, dark-mode-friendly variants for inbox readability. |

---

## Build-time disciplines (consolidated)

These are the rules every build session in Phase 5 must honour. Violating any of them is a spec violation, not a stylistic choice.

1. **Tokens live in three places kept in sync** (`globals.css`, `tailwind.config.ts`, `lib/design-tokens.ts`). No raw hex in component code.
2. **One Black Han Sans per closed-list location only** — never elsewhere. Closed list above.
3. **One red CTA per screen, maximum.** Red anywhere else must earn it (error state only).
4. **Tier 2 motion only in 7 closed moments + 2 overlays.** Anything else uses the house spring.
5. **Sound registry locked at 7.** No additions without explicit Andy approval.
6. **Generous radius (`16px`) only on the 4 closed-list surfaces.** Default is `--radius-default` (8px).
7. **Pink is customer-warmth + focus rings only.** Almost never in admin chrome.
8. **No aesthetic customisation outside the locked Settings → Display closed list.** No hex pickers, no font dropdowns, no light mode toggle.
9. **Density preset declared per page layout, never per component.** Every feature spec declares which preset its screens use.
10. **Reduced motion + sounds-off + large-text + compact-density must produce a usable variant of every screen.** Tested in the first Phase 5 UI session and re-verified per feature.
11. **Tokens in JSDoc.** Every custom Lite primitive gets a JSDoc comment listing which tokens it consumes — makes downstream impact analysis trivial when a token changes.

---

## Success criteria

This spec is successful when:

1. Every subsequent Phase 3 feature spec can describe its UI in plain English by referencing **only** tokens, primitives, and patterns from this doc — without inventing new ones or hand-waving "a button somewhere".
2. A new Phase 5 build session can implement a feature surface end-to-end by reading this doc + the relevant feature spec, with **zero** ad-hoc design decisions during the build.
3. A user can change their theme preset, typeface preset, density, motion, sounds, or text size in Settings → Display, and **every screen** updates correctly with no broken layouts.
4. Setting Motion = Reduced + Sounds = Off + Text size = Large + Density = Compact yields a fully usable variant of the entire app — this is the accessibility floor.
5. A reviewer can open any screen built against this spec and answer "is this on-brand?" with a yes, **without consulting Andy**.

---

## Out of scope (explicit non-goals)

- **Light mode.** Locked dark only. No light variant in v1, ever.
- **Custom user colour input** (hex picker, palette builder, theme uploader).
- **Custom user font input** (font dropdown, font upload, font URL).
- **Per-component density override** — density is page-level only.
- **Layout / sidebar position customisation.**
- **Detailed visual mockups of every component** — those happen in the first Phase 5 UI session, against this spec.
- **Sound file sourcing and approval** — deferred to the dedicated Phase 5 sound review session, against the locked registry above.
- **Marketing landing page templates** — deferred to the marketing site spec/sub-mission.
- **Email template visual design** — deferred to the per-feature specs that send email (welcome, magic link, deliverable uploaded, etc.).
- **PDF quote template design** — deferred to the package/quote builder spec.
- **Per-feature page chrome variations** — the global admin shell is locked here; per-page secondary panes are declared in feature specs.
- **Component visual polish** (micro-interactions, hover refinements beyond the locked rules) — deferred to per-component implementation in Phase 5.
- **Storybook / component playground** — out of scope for v1; deferred until there's a second engineer who needs it.

---

## Open questions deferred to Phase 5

These are real questions that don't need to be answered to write *more spec*, but will need answers during the first Phase 5 UI session. Capturing them here so they don't get re-discovered.

1. **Exact `theme-late-shift` and `theme-quiet-hours` token values.** The values above are starting points; the first UI session tunes them in-browser against the actual app and locks the final hex codes back into this spec.
2. **Exact `--success` sage green hex.** Currently `#7BAE7E` as a starting point; needs in-context tuning against the warm-neutral scale.
3. **The 4 actual sound files.** Sourcing happens in the dedicated sound review session — the registry character descriptions above are the brief.
4. **The empty state copy library** — every BHS empty state location needs a dry SuperBad-voice line. Drafted per-feature in feature specs, but they all live in `lib/empty-state-copy.ts` for consistency.
5. **The exact Cubic-bezier curves for Tier 2 #2, #3, #4.** Defined by name above; specific curve values tuned in-browser during Phase 5.
6. **Mobile breakpoints for the admin shell.** Desktop-first, but the eventual responsive breakpoint behaviour is a Phase 5 polish task.
