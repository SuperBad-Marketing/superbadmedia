import type { CallTemplate } from "./types";

export const trialShootPreTemplate: CallTemplate = {
  type: "trial_shoot_pre",
  label: "Pre-Shoot Prep",
  description: "Confirm logistics, recap expectations, and brief yourself on what to watch for during the shoot.",
  sections: [
    {
      id: "logistics",
      title: "Logistics confirmation",
      questions: [
        {
          id: "tp1",
          text: "Confirm date, time, and location. Any access issues, parking, or gear considerations?",
          boldPhrase: "Lock the basics",
          signals: [
            { level: "green", text: "All confirmed, no surprises — you can focus on the creative" },
            { level: "amber", text: "Venue change or time shift — reconfirm with the team and adjust your shot list" },
            { level: "red", text: "They're vague on details 48h out — chase hard, this is a no-show risk" },
          ],
        },
        {
          id: "tp2",
          text: "Who will be there on the day? Anyone I should know about — founders, staff, clients who might appear?",
          signals: [
            { level: "green", text: "Key people confirmed + you know who's the decision-maker on camera" },
            { level: "amber", text: "'Whoever's around' — low commitment, may need to direct on the day" },
          ],
        },
      ],
    },
    {
      id: "expectations",
      title: "Expectations & brief recap",
      questions: [
        {
          id: "tp3",
          text: "Recap what they said they wanted from this in the discovery call. Has anything changed since?",
          signals: [
            { level: "green", text: "Same goals, maybe sharper — they've been thinking about it" },
            { level: "amber", text: "Scope creep — 'can we also film X?' — manage it now, not on the day" },
            { level: "red", text: "Completely different brief — misalignment. Realign before the shoot." },
          ],
        },
        {
          id: "tp4",
          text: "Is there anything specific you want to make sure we capture? Hero shot, a particular space, a process?",
          signals: [
            { level: "green", text: "Specific requests — add them to your shot list" },
            { level: "green", text: "'You're the expert, surprise me' — full creative licence, best case" },
          ],
        },
      ],
    },
    {
      id: "watch_for",
      title: "What to watch for",
      questions: [
        {
          id: "tp5",
          text: "Based on their Brand DNA and business shape — what's the angle? What story are you telling with this shoot?",
          signals: [
            { level: "green", text: "Clear narrative — the shoot has a through-line, not just 'photos of their stuff'" },
            { level: "amber", text: "No clear angle — use the shoot itself to discover it (process, people, space)" },
          ],
        },
        {
          id: "tp6",
          text: "What do you want to learn about them as a retainer prospect? What would make you confident recommending ongoing work?",
          boldPhrase: "Your own read on retainer fit",
          signals: [
            { level: "green", text: "You know what signals to watch for — energy, engagement, taste level, budget indicators" },
            { level: "amber", text: "Unsure — use the shoot as a chemistry test. Do you actually want to work with them long-term?" },
          ],
        },
      ],
    },
  ],
};

export const trialShootPostTemplate: CallTemplate = {
  type: "trial_shoot_post",
  label: "Post-Shoot Debrief",
  description: "Capture how the shoot went, their reaction, and set up the retainer conversation.",
  sections: [
    {
      id: "reaction",
      title: "How it went",
      questions: [
        {
          id: "ts1",
          text: "What was the energy like on the day? Did they get into it or were they going through the motions?",
          boldPhrase: "Genuine engagement vs polite compliance",
          signals: [
            { level: "green", text: "Genuinely excited, suggesting shots, showing you around with pride — high conversion signal" },
            { level: "amber", text: "Pleasant but passive — not disinterested, just not yet sold. Deliverables need to do the heavy lifting." },
            { level: "red", text: "Distracted, delegated to someone else, left early — low intent, deprioritise the retainer push" },
          ],
        },
        {
          id: "ts2",
          text: "Did anything surprise you about the business once you were in the room?",
          signals: [
            { level: "green", text: "Better than expected — richer content opportunity than you thought" },
            { level: "amber", text: "Messy operations, disorganised space — may need to manage the visual story carefully" },
            { level: "red", text: "Red flags — culture issues, understaffed, product quality concerns. Factor into retainer fit." },
          ],
        },
        {
          id: "ts3",
          text: "Did they see any of the images on the day? What was their reaction to the back-of-camera previews?",
          signals: [
            { level: "green", text: "'Oh wow' moments — they're already sold on the visual quality" },
            { level: "amber", text: "Polite — need the final edits to land the wow factor" },
          ],
        },
      ],
    },
    {
      id: "deliverables",
      title: "Deliverables & timeline",
      questions: [
        {
          id: "ts4",
          text: "What did you tell them about turnaround? When will gallery + six-week plan be ready?",
          signals: [
            { level: "green", text: "Specific date set — they know when to expect it and you've got a deadline" },
            { level: "amber", text: "Vague 'a couple of weeks' — pin it down and communicate it" },
          ],
        },
        {
          id: "ts5",
          text: "Anything from the shoot that should feed into the six-week plan you wouldn't have known from the questionnaire?",
          boldPhrase: "On-the-ground intelligence",
          signals: [
            { level: "green", text: "New insights — competitor info, seasonal patterns, team dynamics, content gaps" },
            { level: "green", text: "They casually mentioned budgets, plans, or competitors during the shoot" },
          ],
        },
      ],
    },
    {
      id: "retainer",
      title: "Retainer angle & next steps",
      questions: [
        {
          id: "ts6",
          text: "On a gut level — is this a retainer fit? Why or why not?",
          boldPhrase: "Your honest read",
          signals: [
            { level: "green", text: "Yes — they have budget, need, taste, and you'd enjoy the work" },
            { level: "amber", text: "Maybe — one factor is uncertain (budget, commitment, complexity)" },
            { level: "red", text: "No — mismatch on values, budget, or expectations. Six-week plan is the right exit." },
          ],
        },
        {
          id: "ts7",
          text: "Did the retainer come up during the shoot? What was said?",
          signals: [
            { level: "green", text: "They asked about ongoing work unprompted — buying signal" },
            { level: "green", text: "You planted the seed naturally — 'this is the kind of thing we'd keep doing if we worked together'" },
            { level: "amber", text: "Didn't come up — let the deliverables do the talking, then follow up" },
          ],
        },
        {
          id: "ts8",
          text: "What's the specific next step after delivering the gallery and plan?",
          boldPhrase: "Lock it in",
          signals: [
            { level: "green", text: "A scheduled call to walk through the plan + have the retainer conversation" },
            { level: "amber", text: "'Send it over and I'll have a look' — schedule a follow-up call anyway" },
          ],
        },
      ],
    },
  ],
};
