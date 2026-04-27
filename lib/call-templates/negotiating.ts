import type { CallTemplate } from "./types";

export const negotiatingTemplate: CallTemplate = {
  type: "negotiating",
  label: "Closing Call",
  description: "Final objections, terms, and commitment. Tight and direct.",
  sections: [
    {
      id: "objections",
      title: "Final objections",
      questions: [
        {
          id: "ne1",
          text: "Since we last spoke, has anything changed on your end — priorities, budget, timeline?",
          boldPhrase: "Check for drift",
          signals: [
            { level: "green", text: "Nothing changed — they're still where they were, momentum intact" },
            { level: "amber", text: "Minor shift — new priority, slightly different scope. Adapt the offer." },
            { level: "red", text: "Major change — restructure, budget cut, leadership change. Re-qualify before closing." },
          ],
        },
        {
          id: "ne2",
          text: "What's the one thing that's still unresolved for you? What would tip this from 'probably' to 'definitely'?",
          signals: [
            { level: "green", text: "A small, solvable thing — solve it on the spot" },
            { level: "amber", text: "'I just need to be sure...' — dig into what 'sure' means for them" },
            { level: "red", text: "A fundamental concern they've been sitting on — better to surface it now than lose the deal silently" },
          ],
        },
      ],
    },
    {
      id: "terms",
      title: "Terms & logistics",
      questions: [
        {
          id: "ne3",
          text: "Let's talk practicalities — when would you want to kick off, and what does your onboarding availability look like?",
          boldPhrase: "Assume the yes",
          signals: [
            { level: "green", text: "They engage with logistics — mentally committed, just need the paperwork" },
            { level: "amber", text: "'Not sure yet' — they may not be as close as you think. Revisit objections." },
          ],
        },
        {
          id: "ne4",
          text: "Any preferences on billing — monthly vs upfront, start date alignment?",
          signals: [
            { level: "green", text: "Asks practical payment questions — this is a buying conversation" },
            { level: "amber", text: "Cash flow concerns — offer monthly to reduce friction" },
            { level: "red", text: "Wants heavy discounting or unusual terms — hold your value, don't erode margins" },
          ],
        },
        {
          id: "ne5",
          text: "The commitment is [X months]. Here's what happens in month one so you can see results fast.",
          boldPhrase: "Anchor on early value, not duration",
          signals: [
            { level: "green", text: "They nod along — the commitment length isn't a concern" },
            { level: "amber", text: "Pushback on term length — explain the ramp-up reality, or offer a shorter pilot" },
          ],
        },
      ],
    },
    {
      id: "close",
      title: "Close or next step",
      questions: [
        {
          id: "ne6",
          text: "I'd love to work with you. Are you ready to move forward?",
          boldPhrase: "Ask directly",
          signals: [
            { level: "green", text: "'Yes' or 'let's do it' — send the agreement immediately after the call" },
            { level: "amber", text: "'Almost' — ask what 'almost' means, solve it now" },
            { level: "red", text: "'I need more time' — set a specific follow-up date, don't leave it open" },
          ],
        },
        {
          id: "ne7",
          text: "Here's what happens next: I'll send the agreement today. Once signed, we'll schedule the onboarding call for [date]. Sound good?",
          boldPhrase: "Make the next step effortless",
          signals: [
            { level: "green", text: "Agrees + locks in a date — this is won" },
            { level: "amber", text: "Wants to 'review the agreement' — set a 48h follow-up call" },
            { level: "red", text: "Goes quiet — they're not ready. Park it, follow up in a week, don't push." },
          ],
        },
      ],
    },
  ],
};
