export interface ReflectionQuestion {
  index: number;
  question: string;
  type: "single" | "freetext" | "freetext_optional";
  options?: string[];
  placeholder?: string;
  skipLabel?: string;
  characterLimit?: number;
}

export const REFLECTION_QUESTIONS: ReflectionQuestion[] = [
  {
    index: 1,
    question:
      "Before we get into it — was there anything about the shoot that wasn't right?",
    type: "single",
    options: [
      "Everything was great — let's keep going",
      "There was something off — I'd like to share",
    ],
  },
  {
    index: 2,
    question: "How did the shoot feel?",
    type: "single",
    options: [
      "Better than I expected",
      "About what I expected — in a good way",
      "It was fine, nothing remarkable",
      "A bit awkward, but the result was worth it",
    ],
  },
  {
    index: 3,
    question:
      "Now that you've seen everything — the photos, the video, the plan — was it worth the investment?",
    type: "single",
    options: [
      "Genuinely, yes",
      "More than I expected",
      "It was fair — I got what I paid for",
      "I'm not sure yet — I need more time with it",
    ],
  },
  {
    index: 4,
    question: "What was it like working with Andy?",
    type: "single",
    options: [
      "Easy — he got it quickly",
      "Surprisingly hands-off — in a good way",
      "He pushed me in directions I wouldn't have gone myself",
      "Professional, but I'd need more time to build trust",
      "He listened more than I expected",
    ],
  },
  {
    index: 5,
    question:
      "Was there a moment, a photo, or something in the plan that stood out?",
    type: "freetext_optional",
    placeholder: "The thing you'd show someone if they asked what you got.",
    skipLabel: "Nothing specific — skip this one",
    characterLimit: 500,
  },
  {
    index: 6,
    question:
      "If this was the beginning of something longer, what would that look like for your business?",
    type: "single",
    options: [
      "Regular shoots — keep the content fresh",
      "Someone handling the strategy, not just the camera",
      "A proper marketing partner who knows my business",
      "I'd want to see results first before thinking bigger",
      "I'm not sure yet, but I'm curious",
    ],
  },
  {
    index: 7,
    question:
      "If you kept working with SuperBad, what would you want us to handle?",
    type: "single",
    options: [
      "Content — photos, video, the creative side",
      "Strategy — telling me what to do and when",
      "Execution — actually running the ads, the emails, the posting",
      "All of it — I want it off my plate",
      "I'm not ready to think about that yet",
    ],
  },
];

export const SAFETY_VALVE_PROMPT =
  "Tell us what happened. No filter needed.";
export const SAFETY_VALVE_PLACEHOLDER =
  "Whatever it is, we'd rather hear it.";
