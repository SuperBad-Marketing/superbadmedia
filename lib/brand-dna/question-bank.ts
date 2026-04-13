/**
 * Brand DNA Assessment — stub question bank.
 *
 * 3 placeholder questions × 5 sections = 15 stubs.
 * Each option maps to 1–3 signal tag strings.
 *
 * Final question bank ships in the Brand DNA content mini-session.
 * At that point, this file is replaced in-place with the full bank
 * (15 questions × 5 sections, track/shape variants).
 *
 * question_id format (stub): "s<section>_<index:03>" e.g. "s1_001".
 * Exact format locked at the content mini-session; stubs use this prefix.
 *
 * Owner: BDA-2. Consumer: BDA-3 (tag aggregation for profile generation).
 */

export interface QuestionOption {
  /** Display text shown on the answer card. */
  text: string;
  /** Signal tags this option awards. 1–3 strings. */
  tags: string[];
}

export interface Question {
  /** Stable key referencing this question. Matches brand_dna_answers.question_id. */
  id: string;
  /** Core section this question belongs to (1–5). */
  section: 1 | 2 | 3 | 4 | 5;
  /** The question text shown on the card. */
  text: string;
  /** Four answer options. */
  options: {
    a: QuestionOption;
    b: QuestionOption;
    c: QuestionOption;
    d: QuestionOption;
  };
}

/** Human-readable titles for each of the five core sections. */
export const SECTION_TITLES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Your Brand Voice",
  2: "Your Visual World",
  3: "Client Relationships",
  4: "Your Business Core",
  5: "Your Superpowers",
};

/** Short descriptors shown as subheadings in the section transition card. */
export const SECTION_SUBTITLES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "How do you talk?",
  2: "What do you look like?",
  3: "How do you work?",
  4: "What do you stand for?",
  5: "What makes you different?",
};

export const QUESTION_BANK: Question[] = [
  // ── Section 1 — Your Brand Voice ────────────────────────────────────────────
  {
    id: "s1_001",
    section: 1,
    text: "When a new client first messages you, what's your instinct?",
    options: {
      a: {
        text: "Keep it professional and tidy — first impressions matter.",
        tags: ["polished", "measured"],
      },
      b: {
        text: "Be real with them — I write how I talk.",
        tags: ["authentic", "warmth"],
      },
      c: {
        text: "Ask good questions before saying anything.",
        tags: ["curious", "deliberate"],
      },
      d: {
        text: "Match their energy and see where it goes.",
        tags: ["adaptive", "instinct"],
      },
    },
  },
  {
    id: "s1_002",
    section: 1,
    text: "How would your best client describe your communication style?",
    options: {
      a: {
        text: "Clear and concise — you always know where things stand.",
        tags: ["clarity", "direct"],
      },
      b: {
        text: "Like talking to a mate, but one who actually knows their stuff.",
        tags: ["warmth", "expertise"],
      },
      c: {
        text: "Thoughtful. They think before they speak.",
        tags: ["considered", "depth"],
      },
      d: {
        text: "Energetic. You always bring something to the room.",
        tags: ["energy", "presence"],
      },
    },
  },
  {
    id: "s1_003",
    section: 1,
    text: "Pick the line that sounds most like you in a proposal:",
    options: {
      a: {
        text: "Here's what we'll do, and here's exactly why it works.",
        tags: ["structured", "logical"],
      },
      b: {
        text: "We made this for you. Not for anyone else.",
        tags: ["personal", "warmth"],
      },
      c: {
        text: "Let me show you what I found first.",
        tags: ["evidence", "methodical"],
      },
      d: {
        text: "I think you're ready for something different.",
        tags: ["bold", "instinct"],
      },
    },
  },

  // ── Section 2 — Your Visual World ───────────────────────────────────────────
  {
    id: "s2_001",
    section: 2,
    text: "If your brand had a home, it would be…",
    options: {
      a: {
        text: "A clean, white-walled studio — everything in its place.",
        tags: ["minimal", "precision"],
      },
      b: {
        text: "A lived-in creative space — beautiful chaos, but it works.",
        tags: ["organic", "creative"],
      },
      c: {
        text: "A heritage building with modern fittings.",
        tags: ["heritage", "craft"],
      },
      d: {
        text: "Somewhere you can't quite place — but you remember it.",
        tags: ["distinctive", "unexpected"],
      },
    },
  },
  {
    id: "s2_002",
    section: 2,
    text: "When you look at your own work, what do you see?",
    options: {
      a: {
        text: "Precision. It's either right or it isn't.",
        tags: ["precision", "craft"],
      },
      b: {
        text: "Feeling. If it doesn't move someone, it's not done.",
        tags: ["emotion", "resonance"],
      },
      c: {
        text: "Story. Every piece should say something.",
        tags: ["narrative", "intention"],
      },
      d: {
        text: "A system. Every element is pulling its weight.",
        tags: ["systematic", "strategic"],
      },
    },
  },
  {
    id: "s2_003",
    section: 2,
    text: "What would you cut from your visual identity if you could?",
    options: {
      a: {
        text: "Anything that feels borrowed.",
        tags: ["original", "distinctive"],
      },
      b: {
        text: "Anything that prioritises style over substance.",
        tags: ["honest", "direct"],
      },
      c: {
        text: "Anything too safe. Safe is forgettable.",
        tags: ["bold", "memorable"],
      },
      d: {
        text: "Anything that's hard to explain.",
        tags: ["clarity", "accessible"],
      },
    },
  },

  // ── Section 3 — Client Relationships ────────────────────────────────────────
  {
    id: "s3_001",
    section: 3,
    text: "What does a great client relationship look like to you?",
    options: {
      a: {
        text: "They trust me to lead. I deliver, they're happy.",
        tags: ["authority", "results"],
      },
      b: {
        text: "We figure it out together. Good work needs real conversation.",
        tags: ["collaboration", "partnership"],
      },
      c: {
        text: "They challenge me. The best briefs push me harder.",
        tags: ["growth", "stretch"],
      },
      d: {
        text: "They come back. That's the only proof that matters.",
        tags: ["loyalty", "longevity"],
      },
    },
  },
  {
    id: "s3_002",
    section: 3,
    text: "When a client is unhappy, what's your first move?",
    options: {
      a: {
        text: "Listen fully before saying anything.",
        tags: ["patience", "empathy"],
      },
      b: {
        text: "Get the facts. What specifically went wrong?",
        tags: ["direct", "analytical"],
      },
      c: {
        text: "Own it if it's ours. Don't if it isn't.",
        tags: ["honest", "accountable"],
      },
      d: {
        text: "Ask what a good resolution looks like to them.",
        tags: ["client-led", "empathy"],
      },
    },
  },
  {
    id: "s3_003",
    section: 3,
    text: "What kind of client brings out your best work?",
    options: {
      a: {
        text: "The ones who are brave enough to trust something different.",
        tags: ["bold", "trust"],
      },
      b: {
        text: "The ones who know their business inside out.",
        tags: ["expertise", "depth"],
      },
      c: {
        text: "The ones who give you room to move.",
        tags: ["freedom", "creative"],
      },
      d: {
        text: "The ones who've outgrown what they had.",
        tags: ["growth", "momentum"],
      },
    },
  },

  // ── Section 4 — Your Business Core ──────────────────────────────────────────
  {
    id: "s4_001",
    section: 4,
    text: "Why SuperBad Marketing? What made you start this?",
    options: {
      a: {
        text: "I wanted to do it right — without compromise.",
        tags: ["integrity", "craft"],
      },
      b: {
        text: "I saw what bad marketing does to good businesses.",
        tags: ["mission", "protection"],
      },
      c: {
        text: "I knew I could do it better than most.",
        tags: ["confidence", "expertise"],
      },
      d: {
        text: "I wanted to build something that was actually mine.",
        tags: ["ownership", "independence"],
      },
    },
  },
  {
    id: "s4_002",
    section: 4,
    text: "What's a line you won't cross — even for a great client?",
    options: {
      a: {
        text: "Producing work I'm not proud of.",
        tags: ["craft", "standards"],
      },
      b: {
        text: "Misrepresenting who a client actually is.",
        tags: ["honest", "integrity"],
      },
      c: {
        text: "Moving too fast to do it properly.",
        tags: ["deliberate", "quality"],
      },
      d: {
        text: "Cutting people out who made the work possible.",
        tags: ["loyalty", "credit"],
      },
    },
  },
  {
    id: "s4_003",
    section: 4,
    text: "How do you define success for your clients?",
    options: {
      a: {
        text: "Their results speak for themselves — revenue, leads, growth.",
        tags: ["results", "measurable"],
      },
      b: {
        text: "They feel genuinely proud of what we made.",
        tags: ["pride", "quality"],
      },
      c: {
        text: "They're still calling us six months later.",
        tags: ["longevity", "relationship"],
      },
      d: {
        text: "Their audience finally gets it.",
        tags: ["clarity", "resonance"],
      },
    },
  },

  // ── Section 5 — Your Superpowers ─────────────────────────────────────────────
  {
    id: "s5_001",
    section: 5,
    text: "What do people remember about working with you?",
    options: {
      a: {
        text: "That you always delivered more than they expected.",
        tags: ["exceed", "generosity"],
      },
      b: {
        text: "That you made them feel heard.",
        tags: ["empathy", "warmth"],
      },
      c: {
        text: "That you had an answer when they didn't.",
        tags: ["expertise", "guidance"],
      },
      d: {
        text: "That the work just felt different.",
        tags: ["distinctive", "craft"],
      },
    },
  },
  {
    id: "s5_002",
    section: 5,
    text: "If you had to describe your edge in three words…",
    options: {
      a: {
        text: "Taste, rigour, honesty.",
        tags: ["aesthetic", "precision", "honest"],
      },
      b: {
        text: "Warmth, depth, momentum.",
        tags: ["warmth", "depth", "energy"],
      },
      c: {
        text: "Curiosity, craft, clarity.",
        tags: ["curious", "craft", "clarity"],
      },
      d: {
        text: "Conviction, creativity, care.",
        tags: ["bold", "creative", "empathy"],
      },
    },
  },
  {
    id: "s5_003",
    section: 5,
    text: "What's the thing only you can bring to this?",
    options: {
      a: {
        text: "A point of view built from real experience.",
        tags: ["authority", "experience"],
      },
      b: {
        text: "The ability to make people feel something.",
        tags: ["emotion", "resonance"],
      },
      c: {
        text: "A system that actually scales.",
        tags: ["systematic", "scalable"],
      },
      d: {
        text: "The courage to say the hard thing nicely.",
        tags: ["honest", "direct", "empathy"],
      },
    },
  },
];

/** Return all questions for a given section (1–5). */
export function getQuestionsForSection(
  section: 1 | 2 | 3 | 4 | 5,
): Question[] {
  return QUESTION_BANK.filter((q) => q.section === section);
}

/** Return a single question by its id, or undefined if not found. */
export function getQuestionById(id: string): Question | undefined {
  return QUESTION_BANK.find((q) => q.id === id);
}
