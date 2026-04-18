# Content Engine — Embeddable Opt-in Form Design

**Surface:** HTML embed snippet for subscriber websites. **Spec:** `docs/specs/content-engine.md` §4.2, §16. **Author:** Claude (CMS-3).

---

## Purpose

Subscribers drop an HTML snippet on their website to grow their newsletter list. The form is styled with their Brand DNA visual tokens so it looks native on their site, not like a third-party widget.

---

## Form structure

```html
<div class="sb-newsletter-form" data-token="{embedFormToken}">
  <p class="sb-newsletter-heading">{heading}</p>
  <p class="sb-newsletter-body">{bodyText}</p>
  <form>
    <input type="email" placeholder="{placeholder}" required />
    <button type="submit">{buttonText}</button>
  </form>
  <p class="sb-newsletter-privacy">{privacyLine}</p>
</div>
```

---

## Default copy (overridable per subscriber via config)

- **Heading:** `Stay in the loop.`
- **Body:** `New posts and insights, straight to your inbox. No spam.`
- **Email placeholder:** `Your email`
- **Button:** `Subscribe`
- **Privacy line:** `We'll only email you when we publish. Unsubscribe anytime.`

### States

- **Submitting (button disabled):** `Subscribing…`
- **Success:** heading changes to `You're in.` Body changes to `First email lands next {dayOfWeek}.`
- **Already subscribed:** heading changes to `Already subscribed.` Body changes to `You're on the list. Nothing to do.`
- **Error:** heading changes to `That didn't work.` Body changes to `Try again, or email {contactEmail}.`

---

## Styling approach

CSS generated per subscriber by the `content-generate-embed-form-styles` Haiku prompt, reading Brand DNA visual tokens. The generated CSS is served from a Lite endpoint at `/api/embed-styles/{token}.css`.

### Token mapping

| CSS property | Brand DNA source |
|---|---|
| `--sb-bg` | dominant aesthetic → light (#FAFAFA) or dark (#1A1A18) |
| `--sb-text` | contrast against bg |
| `--sb-accent` | primary brand colour (derived from Brand DNA signals) |
| `--sb-heading-font` | Brand DNA typography preference → mapped to a web-safe equivalent or Google Font |
| `--sb-body-font` | DM Sans default, adjustable |
| `--sb-radius` | Brand DNA aesthetic: `geometric_precision` → 0px, `organic_forms` → 8px, default → 4px |
| `--sb-spacing` | default 16px, adjustable |

### Layout constraints

- Max width: 400px (inline), 100% (full-width variant).
- Responsive: stacks input and button below 360px.
- Input and button inline on desktop, stacked on mobile.
- No box shadow by default (clean). Shadow added if Brand DNA aesthetic tags include `warmth` or `tactile_craft`.
- Border: 1px solid, 10% opacity of text colour. Subtle, not aggressive.

### Embed snippet

Subscribers get a two-line embed:

```html
<div class="sb-newsletter-form" data-token="{token}"></div>
<script src="https://superbadmedia.com.au/lite/api/embed.js" defer></script>
```

The script:
1. Reads the `data-token`.
2. Injects the form HTML.
3. Loads the per-subscriber CSS from `/api/embed-styles/{token}.css`.
4. Handles submission via `fetch` to `/api/embed-subscribe/{token}`.
5. Manages states (loading, success, error, already-subscribed).

No cookies. No tracking pixels. No third-party requests beyond the Lite API.

---

## SuperBad's own embed form

Uses SuperBad's visual identity directly:

- **Background:** Dark Charcoal (#1A1A18)
- **Text:** Warm Cream (#FDF5E6)
- **Accent:** SuperBad Red (#B22848)
- **Heading font:** Righteous, uppercase
- **Body font:** DM Sans
- **Button:** SuperBad Red background, Warm Cream text, 0px radius (geometric)
- **Border:** 1px solid rgba(253, 245, 230, 0.1)

---

## Consent

- `consent_source: 'embed_form'`
- Direct opt-in — no permission pass email (form is on the subscriber's own website, visitor actively submitted).
- Unsubscribe link on every subsequent send.
- Spam Act compliant: the form identifies who'll be sending and includes the privacy pointer.
