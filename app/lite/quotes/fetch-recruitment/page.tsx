import * as React from "react";

/* ------------------------------------------------------------------ */
/* Fetch Recruitment — bespoke one-off quote page.                    */
/*                                                                    */
/* PDF-export version. This page is rendered once via Playwright      */
/* `page.pdf()` (screen-media emulation preserved) to produce         */
/* SuperBad-Fetch-Recruitment-Quote-SB-FETCH-001.pdf, which is the    */
/* actual deliverable sent to the client. The route stays up for      */
/* re-renders; nothing interactive should be added to it.             */
/* ------------------------------------------------------------------ */

const QUOTE_REF = "SB-FETCH-001";
const DATE_PREPARED = "16 April 2026";
const CLIENT_NAME = "Fetch Recruitment";

type AddOn = {
  id: string;
  title: string;
  description: string;
  price: number;
  unit: "each" | "per variant" | "per video" | "flat";
};

const ADD_ONS: readonly AddOn[] = [
  {
    id: "extra-edit",
    title: "Additional edit from captured footage",
    description:
      "Already-shot moment, recut into a new piece. Good for getting more mileage out of a strong day.",
    price: 250,
    unit: "each",
  },
  {
    id: "ad-variant",
    title: "Ad creative variant (hook or CTA swap)",
    description:
      "Same video, different opening or end-card. Designed for testing in paid media.",
    price: 150,
    unit: "per variant",
  },
  {
    id: "open-caption",
    title: "Subtitled / open-caption version for paid social",
    description:
      "Burned-in captions optimised for sound-off feed scrolling.",
    price: 80,
    unit: "each",
  },
  {
    id: "extra-cutdown",
    title: "Extra short-form cutdown (15s vertical)",
    description: "Beyond the 2–4 included in the base block.",
    price: 200,
    unit: "each",
  },
  {
    id: "extra-halfday",
    title: "Additional half-day shoot",
    description:
      "If a third location or angle becomes worth capturing. Quoted separately if more than one is needed.",
    price: 1800,
    unit: "flat",
  },
  {
    id: "brief-complete",
    title: "Brief template completion (per video)",
    description:
      "If at any point you'd rather hand the brief writing back to us. We'll scope, plan and write the brief from a 20-minute call.",
    price: 120,
    unit: "per video",
  },
];

function formatAud(n: number): string {
  return `$${n.toLocaleString("en-AU")}`;
}

function formatUnit(unit: AddOn["unit"]): string {
  if (unit === "flat") return "";
  return `/ ${unit}`;
}

/* ------------------------------------------------------------------ */
/* Font variable references — pinned to specific faces so the page    */
/* ignores whatever typeface preset the viewer's session happens to   */
/* be on. Fetch sees the house stack regardless.                      */
/* ------------------------------------------------------------------ */

const FONT_DISPLAY = "var(--font-black-han-sans), system-ui, sans-serif";
const FONT_LABEL = "var(--font-righteous), system-ui, sans-serif";
const FONT_BODY = "var(--font-dm-sans), system-ui, sans-serif";
const FONT_LOGO = "var(--font-pacifico), cursive";

export default function FetchRecruitmentQuotePage() {
  return (
    <div
      className="fetch-quote"
      style={{
        backgroundColor: "var(--brand-charcoal)",
        color: "var(--neutral-300)",
        fontFamily: FONT_BODY,
        minHeight: "100vh",
        position: "relative",
      }}
    >
      {/* Ambient warm wash — same treatment as the admin quote mockup, subdued. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          background:
            "radial-gradient(ellipse at 85% 5%, rgba(242,140,82,0.06), transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(178,40,72,0.05), transparent 60%)",
        }}
      />

      <main
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 760,
          margin: "0 auto",
          padding: "48px 24px 72px",
        }}
      >
        {/* ---------- A. Hero ---------- */}
        <section style={{ paddingTop: 32, paddingBottom: 56 }}>
          <div
            style={{
              fontFamily: FONT_LABEL,
              fontSize: 13,
              letterSpacing: "0.14em",
              color: "var(--brand-pink)",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Prepared for
          </div>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: "clamp(44px, 9vw, 88px)",
              lineHeight: 1.0,
              color: "var(--brand-cream)",
              letterSpacing: "-0.01em",
              marginBottom: 28,
            }}
          >
            {CLIENT_NAME}
          </h1>
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 17,
              lineHeight: 1.55,
              color: "var(--neutral-300)",
              maxWidth: "60ch",
            }}
          >
            A focused production block — built around what you brief, shot in
            two half-days, edited in-house.
          </p>

          <div
            style={{
              marginTop: 64,
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
              fontFamily: FONT_LABEL,
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--neutral-500)",
            }}
          >
            <span>Prepared {DATE_PREPARED}</span>
            <span aria-hidden>·</span>
            <span>Ref {QUOTE_REF}</span>
          </div>
        </section>

        {/* ---------- B. Intro ---------- */}
        <section style={{ paddingBottom: 56, maxWidth: "62ch" }}>
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 17,
              lineHeight: 1.65,
              color: "var(--neutral-100)",
            }}
          >
            This is the next block of work — built around what we&rsquo;ve
            learned from running content together so far. The structure below
            covers what&rsquo;s included, what&rsquo;s optional, and where your
            existing credit lands.
          </p>
        </section>

        {/* ---------- C. Base package ---------- */}
        <BasePackageCard />

        {/* ---------- D. Add-on pricing ---------- */}
        <section style={{ paddingTop: 72 }}>
          <header style={{ marginBottom: 28 }}>
            <div
              style={{
                fontFamily: FONT_LABEL,
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--brand-pink)",
                marginBottom: 10,
              }}
            >
              Optional
            </div>
            <h2
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 36,
                color: "var(--brand-cream)",
                lineHeight: 1.05,
                marginBottom: 12,
              }}
            >
              Add-on pricing
            </h2>
            <p
              style={{
                fontFamily: FONT_BODY,
                fontSize: 15,
                lineHeight: 1.6,
                color: "var(--neutral-300)",
                maxWidth: "58ch",
              }}
            >
              Reference rates for anything beyond the base block. Nothing here
              is added on — listed so you know the cost before asking.
            </p>
          </header>

          <div style={{ display: "grid", gap: 16 }}>
            {ADD_ONS.map((a) => (
              <AddOnReference key={a.id} addOn={a} />
            ))}
          </div>
        </section>

        {/* ---------- E. How this works ---------- */}
        <section style={{ paddingTop: 72 }}>
          <h2
            style={{
              fontFamily: FONT_LABEL,
              fontSize: 13,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--brand-pink)",
              marginBottom: 28,
            }}
          >
            How this works
          </h2>
          <ol
            style={{
              display: "grid",
              gap: 28,
              listStyle: "none",
              padding: 0,
            }}
          >
            <HowStep
              n="01"
              title="You brief."
              body="Each video is produced against a completed Fetch brief — what we shoot is what's briefed. Templates go out the week before each shoot."
            />
            <HowStep
              n="02"
              title="We shoot and edit."
              body="Two half-days, two locations, captured by Andy. Edits handled in-house, delivered as locked drafts with one revision round."
            />
            <HowStep
              n="03"
              title="You receive."
              body="Final files delivered in the formats you need. Credit is applied on delivery of the first batch."
            />
          </ol>
        </section>

        {/* ---------- F. Scope note ---------- */}
        <aside
          style={{
            marginTop: 48,
            backgroundColor: "var(--brand-cream)",
            color: "var(--brand-charcoal)",
            padding: "24px 32px",
            borderRadius: 4,
            maxWidth: "68ch",
            breakInside: "avoid",
            pageBreakInside: "avoid",
          }}
        >
          <div
            style={{
              fontFamily: FONT_LABEL,
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--brand-red)",
              marginBottom: 12,
            }}
          >
            A note on scope
          </div>
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--brand-charcoal)",
            }}
          >
            The Base Block covers exactly what&rsquo;s listed above — eight
            hero videos, captured across two half-day shoots, briefed in
            advance via the Fetch brief template. Anything outside that
            (additional shoots, additional concepts, re-shoots driven by brief
            changes) sits in the add-ons or gets scoped separately. This
            isn&rsquo;t bureaucracy — it&rsquo;s how we keep the work tight
            and the timeline honest.
          </p>
        </aside>

        {/* ---------- G. Sign-off ---------- */}
        <section
          style={{
            paddingTop: 40,
            paddingBottom: 16,
            textAlign: "center",
            breakInside: "avoid",
            pageBreakInside: "avoid",
          }}
        >
          <div
            style={{
              fontFamily: FONT_LOGO,
              fontSize: 28,
              color: "var(--brand-cream)",
            }}
          >
            SuperBad
          </div>
          <div
            style={{
              marginTop: 10,
              fontFamily: FONT_LABEL,
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--neutral-500)",
            }}
          >
            Ref {QUOTE_REF} · Prepared {DATE_PREPARED}
          </div>
        </section>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Base package — visually the anchor of the page. Pink/orange border */
/* on charcoal. Pricing stacks below inclusions on mobile.            */
/* ------------------------------------------------------------------ */

function BasePackageCard() {
  return (
    <section
      style={{
        position: "relative",
        backgroundColor: "var(--surface-1)",
        border: "1px solid var(--brand-orange)",
        borderRadius: 16,
        padding: "36px 36px 40px",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-righteous), sans-serif",
          fontSize: 12,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--brand-pink)",
          marginBottom: 12,
        }}
      >
        The package
      </div>
      <h2
        style={{
          fontFamily: "var(--font-black-han-sans), sans-serif",
          fontSize: 44,
          lineHeight: 1.0,
          color: "var(--brand-cream)",
          marginBottom: 16,
          letterSpacing: "-0.005em",
        }}
      >
        The Base Block
      </h2>
      <p
        style={{
          fontFamily: "var(--font-righteous), sans-serif",
          fontSize: 17,
          color: "var(--brand-orange)",
          marginBottom: 28,
          letterSpacing: "0.01em",
        }}
      >
        Two half-days. Eight hero videos. Built from your briefs.
      </p>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gap: 12,
          marginBottom: 36,
        }}
      >
        {[
          "2 × half-day shoots in Melbourne (1 construction site, 1 office)",
          "Pre-production planning from your completed brief templates",
          "Direction, camera, sound — handled in-house by Andy",
          "8 hero videos, fully edited (30–60s each, depending on the brief)",
          "2–4 short-form cutdowns from existing footage (15–20s, vertical)",
          "Colour grade, sound mix, captions, multi-aspect delivery (16:9, 9:16, 1:1 where appropriate)",
          "One round of revisions per video",
        ].map((line) => (
          <li
            key={line}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              fontFamily: "var(--font-dm-sans), sans-serif",
              fontSize: 15,
              lineHeight: 1.55,
              color: "var(--neutral-100)",
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: "var(--brand-orange)",
                marginTop: 9,
                flexShrink: 0,
              }}
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {/* Pricing block — kept together across page breaks so the
          Total-owing row never orphans. */}
      <div
        style={{
          borderTop: "1px solid var(--neutral-600)",
          paddingTop: 24,
          display: "grid",
          gap: 8,
          breakInside: "avoid",
          pageBreakInside: "avoid",
        }}
      >
        <Row
          label="Package value"
          value="$5,600"
          valueStyle={{
            color: "rgba(253, 245, 230, 0.45)",
            textDecoration: "line-through",
          }}
        />
        <Row
          label="Existing credit applied"
          value="–$4,500"
          valueStyle={{ color: "var(--brand-pink)" }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            paddingTop: 14,
            marginTop: 8,
            borderTop: "1px solid var(--neutral-700)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-righteous), sans-serif",
              fontSize: 14,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--neutral-300)",
            }}
          >
            Total owing
          </span>
          <span
            style={{
              fontFamily: "var(--font-black-han-sans), sans-serif",
              fontSize: 56,
              lineHeight: 1,
              color: "var(--brand-red)",
              letterSpacing: "-0.01em",
            }}
          >
            $0
          </span>
        </div>
      </div>

      <p
        style={{
          marginTop: 28,
          fontFamily: "var(--font-playfair-display), Georgia, serif",
          fontStyle: "italic",
          fontSize: 16,
          lineHeight: 1.55,
          color: "var(--neutral-300)",
          maxWidth: "62ch",
        }}
      >
        This package reflects existing credit and the structure we&rsquo;ve
        built together to date. Future work will be scoped fresh against
        current production rates.
      </p>
    </section>
  );
}

function Row({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-dm-sans), sans-serif",
          fontSize: 14,
          color: "var(--neutral-500)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-righteous), sans-serif",
          fontSize: 18,
          color: "var(--neutral-100)",
          ...valueStyle,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add-on reference row — static; no toggle, no quantity.              */
/* ------------------------------------------------------------------ */

function AddOnReference({ addOn }: { addOn: AddOn }) {
  return (
    <div
      style={{
        backgroundColor: "var(--surface-1)",
        border: "1px solid var(--neutral-700)",
        borderRadius: 12,
        padding: "22px 24px",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 20,
        alignItems: "start",
        breakInside: "avoid",
        pageBreakInside: "avoid",
      }}
    >
      <div>
        <h3
          style={{
            fontFamily: "var(--font-righteous), sans-serif",
            fontSize: 17,
            color: "var(--brand-cream)",
            letterSpacing: "0.005em",
            margin: "0 0 8px 0",
          }}
        >
          {addOn.title}
        </h3>
        <p
          style={{
            fontFamily: "var(--font-dm-sans), sans-serif",
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--neutral-300)",
            margin: 0,
            maxWidth: "54ch",
          }}
        >
          {addOn.description}
        </p>
      </div>

      <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <span
          style={{
            fontFamily: "var(--font-righteous), sans-serif",
            fontSize: 20,
            color: "var(--brand-orange)",
          }}
        >
          {formatAud(addOn.price)}
        </span>
        {addOn.unit !== "flat" && (
          <span
            style={{
              fontFamily: "var(--font-righteous), sans-serif",
              fontSize: 12,
              color: "var(--neutral-500)",
              marginLeft: 6,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {formatUnit(addOn.unit)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* How-it-works numbered step                                          */
/* ------------------------------------------------------------------ */

function HowStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "72px 1fr",
        gap: 18,
        alignItems: "baseline",
        breakInside: "avoid",
        pageBreakInside: "avoid",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-black-han-sans), sans-serif",
          fontSize: 40,
          color: "var(--brand-orange)",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {n}
      </span>
      <div>
        <h3
          style={{
            fontFamily: "var(--font-righteous), sans-serif",
            fontSize: 18,
            color: "var(--brand-cream)",
            marginBottom: 8,
            letterSpacing: "0.01em",
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontFamily: "var(--font-dm-sans), sans-serif",
            fontSize: 15,
            lineHeight: 1.6,
            color: "var(--neutral-300)",
            maxWidth: "60ch",
            margin: 0,
          }}
        >
          {body}
        </p>
      </div>
    </li>
  );
}
