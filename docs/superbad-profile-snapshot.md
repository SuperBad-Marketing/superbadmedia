# SuperBad Profile Snapshot

> Auto-generated 2026-04-28. Source of truth is the database; this file is a convenience export for Claude Code build sessions.

## Identity

SuperBad Marketing, legally registered as SuperBad Media, is a solo founder business based in Melbourne, Australia, established by Andy Robinson. The company operates a website at superbadmedia.com.au and can be contacted via andy@superbadmedia.com.au. The business focuses on content creation with an emphasis on emotional engagement.

- **Business Name:** SuperBad Marketing
- **Legal Name:** SuperBad Media
- **Founder Name:** Andy Robinson
- **Location:** Melbourne, Australia
- **Structure:** solo_founder
- **Tagline:** Content that makes people feel something.
- **Website Url:** superbadmedia.com.au
- **Contact Email:** andy@superbadmedia.com.au

## Services

The business offers two trial shoot packages for content creation. The Session package ($397) includes 60–90 minutes on-site, one short-form video, 10–15 edited photographs, a six-week marketing plan, and private portal access. The Production package ($597) provides up to two hours on-site with two short-form videos, 20–25 edited photographs, the same marketing plan, and portal access.

- **Services:** [object Object], [object Object]

## Voice Rules

The profile maintains a dry, observational tone marked by self-deprecation and Melbourne wit, using short sentences with deliberate pauses. It explicitly avoids corporate jargon like "synergy," "leverage," and "game-changer," and applies humor without explanation while prioritizing authenticity. The voice shifts slightly depending on context—functioning as a dry roommate with internal audiences, an observant bartender with clients, and a warm (but non-sales-focused) bartender with the public.

- **Tone Description:** Dry, observational, self-deprecating, slow burn
- **Tone Markers:** dry, observational, self-deprecating, Melbourne wit
- **Banned Words:** synergy, leverage, solutions, elevate, game-changer, unlock, journey, ecosystem, deliver value
- **Sentence Style:** Short sentences. Leave room for the mutter.
- **Humour Rules:** Never explain the joke. Real first.
- **Register Admin:** Dry roommate who notices your habits
- **Register Client:** Observant bartender who reads the room
- **Register Public:** Observant bartender — warm, never pitchy
- **Exclamation Marks:** false
- **Emoji Policy:** Only if the client uses them first

## External Design Rules

The brand employs a dark-background colour scheme dominated by charcoal with warm accents in red, cream, pink, and orange, applying a 1970s aesthetic inspired by retro album covers and vintage design. Typography is layered across multiple typefaces—Black Han Sans for headlines, Righteous for labels, Playfair Display for editorial content, and DM Sans for body text—with typography itself used as a graphic element. The visual approach draws from Wes Anderson's compositional style and self-deprecating British comedy, prioritizing cinematic, candid photography and polished production paired with human, understated content across all formats from social posts to PDFs and emails.

- **Colour Palette:** {"primary":"#B22848","background":"#1A1A18","text":"#FDF5E6","accent_pink":"#F4A0B0","accent_orange":"#F28C52"}
- **Colour Ratio:** 60% Dark Charcoal, 20% SuperBad Red, 10% Warm Cream, 6% Retro Pink, 4% Retro Orange
- **Typography Display:** Black Han Sans — headlines and hero text only, never body
- **Typography Labels:** Righteous — subheadings and labels, always uppercase, generous letter-spacing
- **Typography Editorial:** Playfair Display — pull quotes and manifesto, italic preferred
- **Typography Body:** DM Sans — body font, italic in Retro Pink for mutters and asides
- **Typography Logo:** Pacifico — logo wordmark only, no other use
- **Dark Over Light:** true
- **Visual Era:** 1970s warmth — retro geometry, tactile imperfection, warm palettes. Brenton Wood album covers, vintage Penguin paperbacks
- **Composition Style:** Wes Anderson — intentional framing, generous negative space, controlled density
- **Photography Style:** Cinematic, candid over posed, real emotion over manufactured expression
- **Typography As Graphic:** true
- **Production Philosophy:** High production, low ego — polished and cinematic visuals with self-deprecating, human content inside them
- **Overall Feeling:** Found, not targeted. Quietly confident. Warm not cold. Premium not corporate. Against the grain.
- **Cultural References:** Wes Anderson — intentional framing, absurd premise with complete sincerity, The Office + Fawlty Towers — characters who know exactly what's happening and say nothing, Jimmy Carr — setup, punchline, nothing wasted, Brenton Wood — unexpected, warm, slightly left of field
- **Social Post Rules:** Typography-forward. Headlines as visual elements. No stock photography. No generic marketing layouts. Every post should feel like it belongs on a gallery wall, not a feed.
- **Pdf Rules:** Branded cover page, company-name-derived filenames, visible SuperBad mark. Dark background default.
- **Email Rules:** Minimal design, no heavy HTML templates. Dark palette. Copy does the work, not layout.

## Internal Design Rules

The design system enforces consistent UI patterns across the platform, including a standardized admin shell with navigation, branded page chrome using custom typography and color tokens, and a warm dark palette with graduated border radius. Motion design follows a spring-based easing curve while respecting user accessibility preferences, and all interactive elements—from forms to tables—are wrapped in structured workflows rather than presented as raw components. The approach prioritizes accessibility to WCAG 2.1 AA standards, uses the Lucide icon library, and applies mobile-first responsive design with bottom navigation on smaller screens.

- **Admin Shell:** Every admin page wraps in AdminShellWithNav — sidebar, animated nav, bottom nav for mobile, braindump FAB
- **Page Chrome:** Every page gets: brand font/colour tokens, display heading (Black Han Sans), breadcrumb/eyebrow (Righteous, uppercase), narrative tagline (Playfair Display italic)
- **Surface Strategy:** Warm stacked tints — dark charcoal base, surface cards at #222220, borders at #3A3A38
- **Motion House Spring:** { type: "spring", stiffness: 300, damping: 30, mass: 1 }
- **Motion Reduced:** Respect prefers-reduced-motion — instant reposition (duration: 0), never disable
- **Radius Style:** Graduated soft radius — 6px for small elements, 8px for cards, never fully rounded
- **Density Default:** Comfortable density — generous padding, readable spacing. Compact mode available via settings
- **Empty States:** Never a blank screen. Three-state rule: loading → error → empty → success. Empty states get a dry one-liner
- **Icon Library:** Lucide React — consistent across all surfaces
- **Form Style:** No raw forms. All input flows wrapped in step-by-step wizards or inline editors. Never a wall of fields
- **Table Style:** Clean tables with hover highlight, sticky headers, muted column labels in Righteous uppercase
- **Sound Approach:** Subtle, Apple-satisfying. Visibility-gated (only fire if the triggering element is in viewport). Use-sound library
- **Mobile Approach:** Desktop-first, mobile-functional. Bottom nav on mobile, responsive layouts, no horizontal scroll
- **No Generic Tailwind:** No default Tailwind styling on page chrome. Every surface uses brand tokens. If it looks like a template, it's wrong
- **Accessibility Baseline:** WCAG 2.1 AA. Semantic HTML, keyboard navigable, screen reader tested on critical flows

## Audience

The business serves small-to-medium enterprises across Melbourne on-site, with capacity for remote clients nationwide and global SaaS companies. They work with clients across all verticals who prioritise brand aesthetics, authentic messaging, and long-term content investment, while avoiding those seeking templated solutions, quick viral results, or treating creative work as a commodity.

- **Primary Description:** Small-to-medium businesses in Melbourne and beyond
- **Geography:** Melbourne on-site, Australia-wide remote, global for SaaS
- **Verticals:** 
- **Vertical Philosophy:** If it's a real business, we'll find the story.
- **Ideal Client Traits:** Cares about how their brand looks and feels, Has something real to say — not just chasing trends, Ready to invest in content that lasts
- **Anti Patterns:** Wants templated, generic marketing, Expects overnight virality, Treats creative as a commodity

## Positioning

SuperBad positions itself as an entertainment-focused marketing service that prioritizes watchable content over traditional advertising approaches. The operation is run by solo founder Andy, who handles shooting, editing, and strategy directly, while leveraging AI tools to streamline operations without sacrificing a handcrafted aesthetic. Rather than offering templated solutions, the company prices based on outcomes through retainers and SaaS models, with trial shoots used to demonstrate its production quality and strategic value.

- **One Liner:** Entertainment-first marketing for businesses that actually have something to say.
- **Differentiators:** Entertainment anchor — content people want to watch, not skip, Solo founder, no layers — Andy shoots, edits, and strategises, AI-powered operations that look handmade, No templated content — every piece is bespoke
- **Philosophy:** Entertainment-first marketing. Content should feel like it was found, not targeted. High production, low ego — polished visuals with human, self-deprecating content inside them.
- **Pricing Philosophy:** Value-first, no discounts. Trial shoot proves the work. Retainers and SaaS are priced for the outcome, not the hours.
- **Competitors Context:** Most agencies sell hours or packages. SuperBad sells a feeling — the content is the proof, the strategy is the bonus.

## Current Focus

The company is launching SuperBad Lite, a SaaS platform featuring CRM, client portal, and outreach automation capabilities. Current priorities include completing Lite v1.0, migrating away from GHL, establishing a portfolio through trial shoots targeting larger businesses, and automating outreach for booking conversions. This represents a strategic shift toward developing a software product alongside its core services business.

- **Current Quarter Focus:** Launching SuperBad Lite platform — CRM, client portal, SaaS products, outreach automation
- **Growth Priorities:** Ship Lite v1.0 and migrate off GHL, Build portfolio with trial shoots targeting >$500k businesses, Launch outreach automation for trial shoot bookings
- **Active Campaigns:** 
- **Recent Shifts:** Building a SaaS arm alongside the services business — platform becomes a product.

## Social Proof

- **Proof Points:** 

## Origin Story

## Dev-Time Skill References

Load the relevant skills before starting work on these task types:

| Task type | Skills to load |
|---|---|
| UI / frontend build | `distinctive-frontend`, `design-motion-principles`, `superbad-visual-identity` |
| Copywriting / email drafts / client-facing text | `persuasive-copywriting`, `superbad-brand-voice` |
| Visual design / Canva / social graphics | `superbad-visual-identity`, `superbad-brand-voice` |
| Outreach / lead gen | `superbad-outreach-strategy`, `persuasive-copywriting`, `superbad-brand-voice` |
| Architecture / planning | `brainstorming`, `writing-plans`, `spec-driven-development` |
| Debugging | `systematic-debugging` |
| Business context questions | `superbad-business-context` |
