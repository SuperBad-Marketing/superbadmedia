/**
 * Brand DNA Assessment — question bank types.
 *
 * Shared by all section files and the supplement.
 * Owner: CMS-1. Authoritative content: docs/content/brand-dna/.
 */

export type SectionNumber = 1 | 2 | 3 | 4 | 5;
export type Track = "shared" | "founder" | "business";

export interface QuestionOption {
  /** Display text shown on the answer card. */
  text: string;
  /** Signal tags this option awards. 1–3 strings. */
  tags: string[];
}

export interface Question {
  /** Stable key. Matches brand_dna_answers.question_id. Format: "s{section}_q{nn}". */
  id: string;
  /** Core section (1–5). */
  section: SectionNumber;
  /** shared = both tracks (text may differ), founder/business = track-exclusive. */
  track: Track;
  /**
   * Question text. String if identical across tracks.
   * Object with founder/business keys if framing differs.
   * For track-exclusive questions, always a string.
   */
  text: string | { founder: string; business: string };
  /** Four answer options. */
  options: {
    a: QuestionOption;
    b: QuestionOption;
    c: QuestionOption;
    d: QuestionOption;
  };
  /** Whether this question includes visual elements (colour swatches, images, etc). */
  visual?: boolean;
}

export interface SupplementQuestion {
  /** Stable key. Format: "sup_q{nn}". */
  id: string;
  /** Question text (founder_supplement track only — always personal framing). */
  text: string;
  /** Four answer options. Tags are prefixed brand_override.<domain>.<tag>. */
  options: {
    a: QuestionOption;
    b: QuestionOption;
    c: QuestionOption;
    d: QuestionOption;
  };
  /** Whether this question includes visual elements. */
  visual?: boolean;
}

/** Compact builder — reduces per-question boilerplate in section files. */
type Opt = [text: string, tags: string[]];

export function q(
  id: string,
  section: SectionNumber,
  track: Track,
  text: string | { founder: string; business: string },
  a: Opt, b: Opt, c: Opt, d: Opt,
  visual?: boolean,
): Question {
  return {
    id, section, track, text, visual,
    options: {
      a: { text: a[0], tags: a[1] },
      b: { text: b[0], tags: b[1] },
      c: { text: c[0], tags: c[1] },
      d: { text: d[0], tags: d[1] },
    },
  };
}

export function sq(
  id: string,
  text: string,
  a: Opt, b: Opt, c: Opt, d: Opt,
  visual?: boolean,
): SupplementQuestion {
  return {
    id, text, visual,
    options: {
      a: { text: a[0], tags: a[1] },
      b: { text: b[0], tags: b[1] },
      c: { text: c[0], tags: c[1] },
      d: { text: d[0], tags: d[1] },
    },
  };
}
