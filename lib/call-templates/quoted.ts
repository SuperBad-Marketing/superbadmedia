import type { CallTemplate } from "./types";

export const quotedTemplate: CallTemplate = {
  type: "quoted",
  label: "Quote Follow-up",
  description: "Walk through the proposal, handle objections, and move toward a decision.",
  sections: [
    {
      id: "reception",
      title: "Quote reception",
      questions: [
        {
          id: "q1",
          text: "Have you had a chance to go through the proposal in detail?",
          signals: [
            { level: "green", text: "Yes, read it thoroughly — they're engaged and taking this seriously" },
            { level: "amber", text: "'Skimmed it' — walk them through the key points on this call" },
            { level: "red", text: "Haven't looked at it — reschedule. No point walking through a proposal they haven't read." },
          ],
        },
        {
          id: "q2",
          text: "What was your first reaction? Anything jump out — good or bad?",
          boldPhrase: "Unfiltered first impression",
          signals: [
            { level: "green", text: "Positive surprise at the detail or creativity — your proposal stood out" },
            { level: "amber", text: "'Looks good' with no specifics — they're being polite. Probe deeper." },
            { level: "red", text: "Sticker shock or scope confusion — address it now, not via email" },
          ],
        },
        {
          id: "q3",
          text: "Any questions about the scope, deliverables, or how things would work in practice?",
          signals: [
            { level: "green", text: "Practical questions about onboarding, timelines, team — they're mentally past the 'if' and into the 'how'" },
            { level: "amber", text: "Silence — they may not know what to ask. Walk them through a typical month." },
          ],
        },
      ],
    },
    {
      id: "value",
      title: "Value alignment",
      questions: [
        {
          id: "q4",
          text: "Which parts of the proposal excited you most? What felt most valuable?",
          signals: [
            { level: "green", text: "They can name specific deliverables — you know what to emphasise" },
            { level: "amber", text: "'All of it' — flattering but unhelpful. Ask what they'd do first if they signed tomorrow." },
          ],
        },
        {
          id: "q5",
          text: "Was there anything in there you didn't expect, or anything you expected that wasn't included?",
          signals: [
            { level: "green", text: "Pleasantly surprised — you exceeded their mental model of what they'd get" },
            { level: "amber", text: "Something missing — can you add it, or explain why it's not in scope?" },
            { level: "red", text: "Fundamentally different expectations — realignment needed before closing" },
          ],
        },
      ],
    },
    {
      id: "objections",
      title: "Objection handling",
      questions: [
        {
          id: "q6",
          text: "Is the investment in the right ballpark for what you had in mind?",
          boldPhrase: "Price without saying 'price'",
          signals: [
            { level: "green", text: "'Yes' or 'it's a lot but I see the value' — proceed to close" },
            { level: "amber", text: "'It's more than I expected' — explore what they expected and what's driving the gap" },
            { level: "red", text: "'Way over budget' — offer the budget-conscious alternative or scope down. Don't discount." },
          ],
        },
        {
          id: "q7",
          text: "If you could change one thing about this proposal, what would it be?",
          signals: [
            { level: "green", text: "'Nothing, it's solid' — closing time" },
            { level: "amber", text: "A specific change — can you accommodate it without breaking the economics?" },
            { level: "red", text: "Fundamental restructure — you're far apart. Consider whether this is worth chasing." },
          ],
        },
        {
          id: "q8",
          text: "What's your biggest hesitation right now? What would need to be true for this to be a no-brainer?",
          boldPhrase: "Surface the real blocker",
          signals: [
            { level: "green", text: "A solvable concern (timing, a specific deliverable, payment terms)" },
            { level: "amber", text: "'Need to think about it' — ask what specifically they need to think about" },
            { level: "red", text: "Trust or capability concern — address head-on with examples or case studies" },
          ],
        },
      ],
    },
    {
      id: "decision",
      title: "Decision & close",
      questions: [
        {
          id: "q9",
          text: "What's your timeline for making a decision? Is there a date by which you need this underway?",
          signals: [
            { level: "green", text: "Specific date — urgency is real, you can work backward from it" },
            { level: "amber", text: "'Soon' — pin it down. 'If I sent the agreement today, could you sign this week?'" },
            { level: "red", text: "'No rush' — low urgency. Create it: 'I've got capacity now but Q3 fills up fast.'" },
          ],
        },
        {
          id: "q10",
          text: "Is there anyone else who needs to weigh in before you can commit?",
          signals: [
            { level: "green", text: "'It's my call' — you're talking to the decision-maker" },
            { level: "amber", text: "Partner or board involved — ask to present to them directly, don't let it get filtered" },
          ],
        },
        {
          id: "q11",
          text: "Here's what I suggest: I'll [adjust X / send the agreement / follow up by date]. Does that work?",
          boldPhrase: "Close with a concrete next step",
          signals: [
            { level: "green", text: "Agreed + date set — deal is moving" },
            { level: "amber", text: "Hesitant — give them space but set a firm follow-up date" },
          ],
        },
      ],
    },
  ],
};
