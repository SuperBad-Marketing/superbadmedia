# Surprise & Delight — Per-Page Configs

Content source for S&D spec public eggs #8 (rapid scroller) and #9 (deep reader). Resolves PATCHES_OWED: `sd11_rapid_scroller_per_page_summary` and `sd11_deep_reader_link_target`.

These configs are generated at build time per page via `generateInVoice('rapid_scroller_summary', { pageContent })` and cached. The seeds below are the initial calibration — the LLM regenerates when content changes.

---

## Rapid scroller — per-page one-sentence summaries

Each public marketing page gets a single-sentence summary shown when a visitor scrolls top-to-bottom in under 6 seconds.

| Page | Summary |
|---|---|
| Homepage | "we make marketing that people actually watch." |
| About | "melbourne agency. storytellers first, marketers second." |
| Services | "creative production, performance marketing, and subscription tools." |
| Contact | "andy@superbadmedia.com.au. that's genuinely all you need." |
| Portfolio | "real work for real businesses. no stock footage." |
| Blog index | "things we've written. some of them are useful." |
| Pricing / retainers | "custom pricing per client. no rate card." |
| SaaS products index | "automated marketing tools. subscription-based." |
| Trial shoot landing | "one shoot. sixty minutes. see if we're any good." |

*Pages added after launch: the build session for each new public page must include a rapid-scroller summary in its content output. The `generateInVoice` call produces one at build time if no seed exists.*

---

## Deep reader — per-page "deeper piece" link targets

Each public page optionally links to a deeper piece when a visitor dwells 4+ minutes at 70%+ scroll depth. Pages without a deeper piece do not fire the egg (fail-closed per spec).

| Page | Deeper link target | Link exists at launch? |
|---|---|---|
| Homepage | `/about` | Yes |
| About | Blog post: founding story (first blog post to publish) | No — egg disabled until post exists |
| Services | `/portfolio` | Yes |
| Contact | No deeper piece | Egg disabled on this page |
| Portfolio | Individual case study (links to most recent) | No — egg disabled until first case study publishes |
| Blog posts | Next post in series, or related post if standalone | Dynamic — resolved per-post at build time |
| Pricing / retainers | `/trial-shoot` (trial shoot landing) | Yes |
| SaaS products index | Individual product page (links to most popular) | No — egg disabled until product pages exist |
| Trial shoot landing | No deeper piece | Egg disabled on this page |

*Fail-closed rule: if `deeperLinkTarget` is null or the target page doesn't exist, the deep-reader egg does not fire. No fallback. This is tested in the trigger evaluator.*

---

## Rain ambient audio

**PATCHES_OWED: `sd11_rain_ambient_mp3`**

The Melbourne Rain egg (#11) requires a soft rain ambient audio file. Requirements:
- Format: MP3, mono, 128kbps
- Duration: 30-second seamless loop
- Character: gentle, steady rain — not thunderstorm, not drizzle
- Volume: plays at 20% of normal UI sound level
- Must be royalty-free or CC0

**Source options (for asset session):**
1. freesound.org — search "gentle rain loop" under CC0 licence
2. pixabay.com/sound-effects — rain sounds, royalty-free
3. Generate via AI audio tool if available

**File destination:** `public/sounds/rain-ambient.mp3`

*This item remains open until the audio file is sourced and committed. CMS-6 documents the requirement; an asset session or manual commit lands the file.*
