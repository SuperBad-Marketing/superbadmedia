import type { CallTemplate } from "./types";

export const contactedTemplate: CallTemplate = {
  type: "contacted",
  label: "First Response",
  description: "Qualifying call when a prospect responds to outreach or reaches out directly.",
  sections: [
    {
      id: "context",
      title: "Context & qualification",
      questions: [
        {
          id: "c1",
          text: "How did you hear about us / what made you get in touch?",
          boldPhrase: "Origin & urgency",
          signals: [
            { level: "green", text: "A specific trigger — lost a client, competitor doing well, event coming up, seasonal push" },
            { level: "amber", text: "'Just exploring options' — no urgency yet, but open" },
            { level: "red", text: "'Someone told us we should' — buying for the wrong reasons, dig into what they actually need" },
          ],
        },
        {
          id: "c2",
          text: "Give me the 60-second version of your business — what you do, team size, where most of your work comes from.",
          signals: [
            { level: "green", text: "Clear breakdown of services and revenue sources — easy to see where marketing fits" },
            { level: "green", text: "Heavy reliance on one channel (referrals, word of mouth) — obvious opportunity" },
            { level: "amber", text: "Vague or scattered — they may not have clarity on their own positioning yet" },
          ],
        },
        {
          id: "c3",
          text: "What does your marketing look like right now — anything running, or starting from scratch?",
          signals: [
            { level: "green", text: "They know what they've tried and what didn't work — faster to position your approach" },
            { level: "amber", text: "'We post on socials sometimes' — doing something but no strategy" },
            { level: "red", text: "'Nothing' + big expectations — manage timelines early" },
          ],
        },
      ],
    },
    {
      id: "next_step",
      title: "Next step alignment",
      questions: [
        {
          id: "n1",
          text: "What are you actually hoping to get out of working with someone like us?",
          boldPhrase: "Desired outcome",
          signals: [
            { level: "green", text: "Specific — 'more leads in X service', 'better brand presence', 'fill Q3 capacity'" },
            { level: "amber", text: "'Just want to grow' — needs sharpening, but that's what a discovery call is for" },
            { level: "red", text: "Expectations wildly out of proportion to implied budget — flag early" },
          ],
        },
        {
          id: "n2",
          text: "Makes sense. The best next step is a proper discovery call where I can dig into the detail. When works this week or next?",
          boldPhrase: "Lock in discovery call",
          signals: [
            { level: "green", text: "Commits to a specific date — momentum is real" },
            { level: "amber", text: "'I'll get back to you' — set a follow-up date yourself, don't leave it open" },
            { level: "red", text: "Resistant to scheduling — low intent, consider whether this is worth pursuing" },
          ],
        },
      ],
    },
  ],
};
