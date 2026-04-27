import type { CallTemplate } from "./types";

export const conversationTemplate: CallTemplate = {
  type: "conversation",
  label: "Discovery Call",
  description: "Full discovery session. Understand the business, goals, current marketing, audience, and close with next steps.",
  sections: [
    {
      id: "rapport",
      title: "Rapport & context-setting",
      questions: [
        {
          id: "r1",
          text: "How did you hear about us / what made you reach out now?",
          boldPhrase: "Origin & urgency",
          signals: [
            { level: "green", text: "A specific trigger event — lost a tender, dropped enquiries, competitor activity, big event coming up" },
            { level: "amber", text: "'Just thought we should do some marketing' — vague, may need more education on what's possible" },
            { level: "red", text: "'Someone told us we should' — buying for the wrong reasons, dig deeper into what they need" },
          ],
        },
        {
          id: "r2",
          text: "Walk me through the business as it stands today — team size, service mix, where most of your work currently comes from.",
          signals: [
            { level: "green", text: "Clear split across services — helps you see which line they want to grow" },
            { level: "green", text: "Heavy reliance on referrals or one channel — obvious opportunity to diversify" },
            { level: "amber", text: "No clear breakdown — they may not be tracking sources, you'll need to fix this early" },
          ],
        },
      ],
    },
    {
      id: "goals",
      title: "Goals & success criteria",
      questions: [
        {
          id: "g1",
          text: "What does success look like in 6 and 12 months?",
          boldPhrase: "Get specific — number of clients, revenue, type of work",
          signals: [
            { level: "green", text: "A specific number — 'we want 8 more clients by December' — you can reverse-engineer a plan" },
            { level: "green", text: "Mention of a specific client type they want more of" },
            { level: "amber", text: "'More leads' — needs probing. More of what kind? What are leads worth to them?" },
            { level: "red", text: "'Just want to grow' — they haven't thought it through, you'll need to facilitate the strategy" },
          ],
        },
        {
          id: "g2",
          text: "Which part of the business is the priority to grow right now? Why that one?",
          signals: [
            { level: "green", text: "A clear primary focus — much easier to build a campaign around one offer than four" },
            { level: "green", text: "The reasoning reveals the margin / capacity story" },
            { level: "amber", text: "'All of them equally' — push back gently. Resources will be spread thin without a focus." },
          ],
        },
        {
          id: "g3",
          text: "What's the average value of a job in that priority area, and what's the sales cycle from first enquiry to commitment?",
          signals: [
            { level: "green", text: "High AOV + long cycle = content/SEO/nurture-heavy strategy makes sense" },
            { level: "green", text: "They know the numbers cold — mature, easy to work with" },
            { level: "red", text: "No idea on numbers — they may not have CRM or tracking. Flag this as a foundational gap." },
          ],
        },
      ],
    },
    {
      id: "marketing",
      title: "Current marketing & channels",
      questions: [
        {
          id: "m1",
          text: "What marketing have you done up to now — agencies, freelancers, in-house? What worked and what didn't?",
          signals: [
            { level: "green", text: "Honest assessment of past efforts — easier to position what's different about your approach" },
            { level: "amber", text: "Bad agency experience — note their specific frustrations (reporting? communication? results?) and address them" },
            { level: "red", text: "'We've never done any marketing' + huge expectations — manage timelines early" },
          ],
        },
        {
          id: "m2",
          text: "Tell me about your social presence — who runs it, how often, and which platforms actually bring in work versus just get likes?",
          signals: [
            { level: "green", text: "They know which platform drives enquiries — work with what's already converting" },
            { level: "green", text: "Founder has personal brand presence — leverage it" },
            { level: "amber", text: "Sporadic posting, no clear owner — content systemisation opportunity" },
          ],
        },
        {
          id: "m3",
          text: "How do leads come in today — phone, web form, DM, referral — and roughly what's the split?",
          signals: [
            { level: "green", text: "They know their lead sources by percentage — mature tracking" },
            { level: "amber", text: "DM/phone heavy with no logging — lost data, easy quick win to set up tracking" },
            { level: "red", text: "'Not sure' — baseline tracking is your first deliverable, regardless of scope" },
          ],
        },
        {
          id: "m4",
          text: "Have you run paid ads before? Any data on what converted?",
          signals: [
            { level: "green", text: "Past data, even messy — head start on targeting and creative" },
            { level: "amber", text: "'It didn't work' — find out if it was bad targeting, bad creative, or wrong expectations" },
          ],
        },
      ],
    },
    {
      id: "audience",
      title: "Audience & positioning",
      questions: [
        {
          id: "a1",
          text: "Describe your dream client — geography, budget range, what they're really buying from you.",
          signals: [
            { level: "green", text: "A vivid, specific persona — sharp targeting possible" },
            { level: "amber", text: "Generic answer — workshop this together later, it's normal" },
          ],
        },
        {
          id: "a2",
          text: "Who do you see as your real competition — and what do clients say when they pick you over them?",
          signals: [
            { level: "green", text: "Clear differentiators they can articulate — use these in positioning" },
            { level: "green", text: "Specific competitor names — you can run direct positioning" },
            { level: "amber", text: "'We don't really have competition' — blind spot. They probably do." },
          ],
        },
        {
          id: "a3",
          text: "What's the #1 objection or hesitation people have before signing?",
          boldPhrase: "Gold for ad copy and landing pages",
          signals: [
            { level: "green", text: "Specific, recurring objections (price, timing, trust, scope) — direct content angles" },
            { level: "green", text: "Unique objections related to their industry — content goldmine" },
          ],
        },
      ],
    },
    {
      id: "assets",
      title: "Assets, content & operations",
      questions: [
        {
          id: "as1",
          text: "What visual content do you already have — photography, video, drone footage, before/afters? How organised is it?",
          signals: [
            { level: "green", text: "Existing library — massive head-start on content, ads, case studies" },
            { level: "red", text: "'We barely capture anything' — embed content capture into their workflow from day one" },
          ],
        },
        {
          id: "as2",
          text: "Who handles enquiries when they come in, and what's the response time and follow-up process?",
          signals: [
            { level: "green", text: "Clear owner + fast response — marketing spend won't leak out the bottom of a broken funnel" },
            { level: "red", text: "Slow response, no follow-up system — fix this before scaling lead volume" },
          ],
        },
        {
          id: "as3",
          text: "If I delivered 30 qualified leads next month, can you actually handle the work?",
          signals: [
            { level: "green", text: "'Yes, we want to scale' — pure growth play" },
            { level: "amber", text: "'We're already booked out' — strategy shifts to higher-value clients and better filtering, not more volume" },
          ],
        },
      ],
    },
    {
      id: "close",
      title: "Budget, decision-making & next steps",
      questions: [
        {
          id: "cl1",
          text: "Have you set a marketing budget, or are you still working that out?",
          boldPhrase: "Don't ask 'what's your budget' — ask if they have one",
          signals: [
            { level: "green", text: "A real number or range — qualified, can scope to fit" },
            { level: "amber", text: "'Whatever it takes' — needs anchoring. Offer a typical range for their stage." },
            { level: "red", text: "'Very little, want big results' — mismatch. Address upfront or walk." },
          ],
        },
        {
          id: "cl2",
          text: "Who else is involved in this decision and what's your timeline to choose a partner?",
          signals: [
            { level: "green", text: "You're talking to the decision maker + a clear timeline" },
            { level: "amber", text: "Other stakeholders involved — ask to include them in the proposal walkthrough" },
            { level: "red", text: "'No timeline' — low urgency, may stall" },
          ],
        },
        {
          id: "cl3",
          text: "Are you talking to other agencies, and what would make us the obvious pick?",
          signals: [
            { level: "green", text: "Honest answer either way — both are workable" },
            { level: "green", text: "Their criteria become your proposal structure" },
          ],
        },
        {
          id: "cl4",
          text: "Here's what I'll do next: I'll put together a proposal by [date]. Can we lock in a call on [date] to walk through it?",
          boldPhrase: "Lock in the follow-up",
          signals: [
            { level: "green", text: "A specific date for follow-up + their commitment to be on the call" },
            { level: "green", text: "They offer access to data (analytics, ad accounts, past invoices) — high intent" },
          ],
        },
      ],
    },
  ],
};
