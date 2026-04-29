export interface QuestionDef {
  id: string;
  question: string;
  options?: string[];
  freeText?: boolean;
  placeholder?: string;
  charLimit?: number;
  tag?: string;
}

export interface SectionDef {
  heading: string;
  subline: string;
  questions: QuestionDef[];
}

type Shape = "solo_founder" | "founder_led_team" | "multi_stakeholder_company";

const section2: Record<Shape, SectionDef> = {
  solo_founder: {
    heading: "A bit about your business",
    subline:
      "Five quick questions. No wrong answers, we're just getting a picture of where you're at.",
    questions: [
      {
        id: "s2q1",
        question: "How long have you been running this?",
        options: [
          "Less than a year, still figuring it out",
          "1–3 years, finding my groove",
          "3–5 years, I know what works, mostly",
          "5+ years, I've been at this a while",
        ],
      },
      {
        id: "s2q2",
        question: "How do your customers usually find you?",
        options: [
          "Word of mouth, mostly",
          "Social media",
          "Google or ads",
          "A mix of things",
          "Honestly, I'm not sure",
        ],
      },
      {
        id: "s2q3",
        question:
          "What's your main thing right now, growing, or keeping up with what you've got?",
        options: [
          "I need more customers",
          "I've got the customers, I need to keep them coming back",
          "Bit of both",
          "I'm at capacity and need to be more selective",
        ],
      },
      {
        id: "s2q4",
        question:
          "How much time do you spend on marketing in an average week?",
        options: [
          "Almost none, I don't have time",
          "A few hours here and there",
          "A decent chunk, it's a real part of my week",
          "Too much, it's eating into everything else",
        ],
      },
      {
        id: "s2q5",
        question:
          "If someone looked at your business online right now, what would they see?",
        options: [
          "Not much, I've been meaning to sort it out",
          "The basics, a website, maybe some socials",
          "It's decent, but it doesn't really feel like me",
          "It's pretty solid, I just want it to be better",
        ],
      },
      {
        id: "s2q6",
        question:
          "Anything else we should know about your business before the shoot?",
        freeText: true,
        placeholder:
          "The kind of thing you'd mention if we were chatting in person.",
        charLimit: 500,
      },
    ],
  },
  founder_led_team: {
    heading: "A bit about your business",
    subline:
      "Five quick questions. No wrong answers, we're just getting a picture of where you're at.",
    questions: [
      {
        id: "s2q1",
        question: "How long has the business been going?",
        options: [
          "Less than 2 years, still early",
          "2–5 years, established but growing",
          "5–10 years, we've been around",
          "10+ years, well established",
        ],
      },
      {
        id: "s2q2",
        question: "How do most of your customers find you?",
        options: [
          "Referrals and word of mouth",
          "Online, search, social, ads",
          "Outbound, we go find them",
          "A mix of everything",
          "We're not totally sure",
        ],
      },
      {
        id: "s2q3",
        question: "What's the team's biggest constraint right now?",
        options: [
          "We need more leads coming in",
          "We've got leads but can't convert them fast enough",
          "We're growing and need to look the part",
          "We're stretched thin and need to work smarter",
        ],
      },
      {
        id: "s2q4",
        question: "Who handles marketing at the moment?",
        options: [
          "I do, on top of everything else",
          "Someone on the team picks it up when they can",
          "We've got a dedicated person or role",
          "We've tried outsourcing but it hasn't stuck",
        ],
      },
      {
        id: "s2q5",
        question: "How does your business come across online right now?",
        options: [
          "We're behind where we should be",
          "It's okay, but it doesn't match the quality of what we actually do",
          "It's solid, we just want to go further",
          "We've invested, but it hasn't moved the needle",
        ],
      },
      {
        id: "s2q6",
        question:
          "Anything we should know about your team or how you work before the shoot?",
        freeText: true,
        placeholder:
          "Who's involved, how decisions get made, anything useful.",
        charLimit: 500,
      },
    ],
  },
  multi_stakeholder_company: {
    heading: "A bit about your business",
    subline:
      "Five quick questions. No wrong answers, we're just getting a picture of where you're at.",
    questions: [
      {
        id: "s2q1",
        question: "How established is the business?",
        options: [
          "Under 3 years, still building",
          "3–10 years, growing steadily",
          "10+ years, well established",
          "We're in a reinvention phase",
        ],
      },
      {
        id: "s2q2",
        question: "How do new clients or customers usually come in?",
        options: [
          "Referrals and existing relationships",
          "Our sales team goes and finds them",
          "Inbound, they come to us via search, content, ads",
          "Channel partners or third parties",
          "A mix, but we're not sure what's working best",
        ],
      },
      {
        id: "s2q3",
        question:
          "What's the main thing driving the need for better marketing right now?",
        options: [
          "We're growing and need to get the brand out there",
          "We're well known but the content doesn't match who we actually are",
          "New competitors are showing up with better marketing",
          "We're launching something new and need to support it",
          "Leadership wants to see more from what we're spending",
        ],
      },
      {
        id: "s2q4",
        question:
          "How many people are involved in deciding on something like this?",
        options: [
          "Two of us, we'll sort it out between ourselves",
          "A small group, three or four people",
          "It goes through a formal approval process",
          "I'm scoping it out first, then I'll bring it to the team",
        ],
      },
      {
        id: "s2q5",
        question: "How does your business come across online right now?",
        options: [
          "It's dated, we know it needs work",
          "It's professional, but it's not distinctive",
          "It's decent, but it doesn't feel like us",
          "We've invested heavily, we just need the right creative partner",
        ],
      },
      {
        id: "s2q6",
        question:
          "Anything else we should know about the business or the people involved before the shoot?",
        freeText: true,
        placeholder:
          "Who'll be there on the day, any sensitivities, anything useful.",
        charLimit: 500,
      },
    ],
  },
};

const section3: Record<Shape, SectionDef> = {
  solo_founder: {
    heading: "Your content right now",
    subline:
      "What you've got, what you've tried, what drives you mad. No judgement.",
    questions: [
      {
        id: "s3q1",
        question: "What do you currently use for photos of your business?",
        options: [
          "Phone photos, whatever I can grab",
          "I've had a photographer in once or twice",
          "I use stock photos mostly",
          "I don't really have any",
          "I've actually got decent stuff, I just don't use it well",
        ],
      },
      {
        id: "s3q2",
        question: "Have you ever done any video for the business?",
        options: [
          "Never",
          "I've shot a few things on my phone",
          "I hired someone once, it was fine",
          "I hired someone once, it wasn't great",
          "I do it myself and it's actually pretty good",
        ],
      },
      {
        id: "s3q3",
        question: "How do you feel about being on camera?",
        options: [
          "Absolutely not",
          "I'd rather not, but I get it",
          "I'm okay with it",
          "I'm pretty comfortable",
          "I'm good, I just need someone to point the camera",
        ],
      },
      {
        id: "s3q4",
        question:
          "What's the most frustrating thing about your marketing content right now?",
        options: [
          "I don't have any",
          "What I've got doesn't look like me",
          "I can't keep up with posting",
          "I don't know what to post",
          "It looks fine but it doesn't do anything",
        ],
      },
      {
        id: "s3q5",
        question:
          'Is there a business you look at and think, "I wish my stuff looked like that"?',
        freeText: true,
        placeholder: "A name, a handle, a vague memory, anything helps.",
        charLimit: 300,
      },
    ],
  },
  founder_led_team: {
    heading: "Your content right now",
    subline:
      "What you've got, what you've tried, what drives you mad. No judgement.",
    questions: [
      {
        id: "s3q1",
        question:
          "What does your business currently use for photos and video?",
        options: [
          "Phone photos, whoever's around grabs them",
          "We've hired a photographer a few times",
          "We've got a bank of professional content, but it's getting stale",
          "We've tried video but it never felt right",
          "We don't have much at all",
        ],
      },
      {
        id: "s3q2",
        question: "Who in the team would be on camera?",
        options: [
          "Probably just me",
          "Me and one or two others",
          "A few people across the team",
          "We'd rather show the work, not the people",
          "We haven't thought about it yet",
        ],
      },
      {
        id: "s3q3",
        question:
          "What kind of content has actually worked for you so far?",
        options: [
          "Before-and-after posts",
          "Behind-the-scenes stuff",
          "Client testimonials or reviews",
          "Educational or how-to content",
          "Honestly, nothing's really moved the needle",
        ],
      },
      {
        id: "s3q4",
        question: "What's the biggest gap in your content right now?",
        options: [
          "We don't have enough of it",
          "It doesn't match the quality of what we deliver",
          "We post but nobody engages",
          "We don't know what to post",
          "It's scattered, no consistent look or voice",
        ],
      },
      {
        id: "s3q5",
        question: "Any brands or businesses whose content you admire?",
        freeText: true,
        placeholder: "Doesn't have to be in your industry.",
        charLimit: 300,
      },
    ],
  },
  multi_stakeholder_company: {
    heading: "Your content right now",
    subline:
      "What you've got, what you've tried, what drives you mad. No judgement.",
    questions: [
      {
        id: "s3q1",
        question:
          "What does the business currently invest in for content and imagery?",
        options: [
          "We have an in-house person or team",
          "We use agencies or freelancers on and off",
          "We've got a library of assets but it's dated",
          "We've tried a few things but nothing's stuck",
          "Very little, it's been deprioritised",
        ],
      },
      {
        id: "s3q2",
        question: "Who from the business would be involved in a shoot?",
        options: [
          "The founder or CEO",
          "A few key people from leadership",
          "Frontline team, the people doing the work",
          "Clients or customers (with permission)",
          "We'd want to discuss this",
        ],
      },
      {
        id: "s3q3",
        question:
          "What kind of content has performed best for the business historically?",
        options: [
          "Client case studies or testimonials",
          "Thought leadership from a key person",
          "Event or conference content",
          "Product or service demonstrations",
          "We haven't really tracked it",
        ],
      },
      {
        id: "s3q4",
        question:
          'What does "good marketing content" look like to the decision-makers?',
        options: [
          "Professional and polished, nothing rough",
          "Authentic and real, not too corporate",
          "Whatever drives measurable results",
          "Something that sets us apart from competitors",
          "We've never really aligned on it",
        ],
      },
      {
        id: "s3q5",
        question:
          "Any companies in your space (or outside it) whose brand presence you respect?",
        freeText: true,
        placeholder: "The ones where you think, they've figured it out.",
        charLimit: 300,
      },
    ],
  },
};

const section4: Record<Shape, SectionDef> = {
  solo_founder: {
    heading: "Where you want to be",
    subline: "Last section. This one's about what's next.",
    questions: [
      {
        id: "s4q1",
        question:
          "If your marketing was sorted, really sorted, what would change first?",
        options: [
          "I'd have a steady flow of the right customers",
          "People would finally get what I actually do",
          "I'd stop worrying about where the next job comes from",
          "I could charge what I'm worth",
          "I'd have time back, marketing wouldn't be on my plate anymore",
        ],
      },
      {
        id: "s4q2",
        question:
          'What would "getting help with marketing" actually look like for you?',
        options: [
          "Someone who just does it, I don't want to think about it",
          "Someone who shows me what to do, and I'll run it",
          "A mix, guidance plus execution",
          "I'm not sure yet, that's partly why I'm here",
        ],
      },
      {
        id: "s4q3",
        question:
          "What's held you back from investing in this before?",
        options: [
          "Cost, I wasn't sure it was worth it",
          "Trust, I've been burned by agencies before",
          "Time, I couldn't deal with the back-and-forth",
          "I didn't know where to start",
          "Nothing specific, I just hadn't found the right fit",
        ],
      },
      {
        id: "s4q4",
        question: "How quickly are you hoping to see a difference?",
        options: [
          "Within a few weeks, I need momentum now",
          "A couple of months, I'm playing the slightly longer game",
          "Six months, I want to build something that lasts",
          "I don't have a timeline, I just want to start",
        ],
      },
      {
        id: "s4q5",
        question:
          "If you could change one thing about how your business shows up in the world, what would it be?",
        freeText: true,
        placeholder: "First thing that comes to mind.",
        charLimit: 400,
      },
      {
        id: "s4q6",
        tag: "practical_signal",
        question: "Do you currently have an email list or newsletter?",
        options: [
          "No, never set one up",
          "I've got one but I don't use it",
          "Yes, and I send to it occasionally",
          "Yes, and it's a regular thing",
        ],
      },
      {
        id: "s4q7",
        tag: "practical_signal",
        question:
          "Have you run paid ads before, Google, Meta, anything like that?",
        options: [
          "Never",
          "Tried it once, didn't stick",
          "Running some now, but I'm not confident they're working",
          "Running them and they're doing okay",
          "I've spent real money on ads, I know the basics",
        ],
      },
    ],
  },
  founder_led_team: {
    heading: "Where you want to be",
    subline: "Last section. This one's about what's next.",
    questions: [
      {
        id: "s4q1",
        question:
          "If your marketing was really dialled in, what would it unlock for the business?",
        options: [
          "More of the right clients, fewer of the wrong ones",
          "We'd be known in our space, not just another option",
          "The team could focus on delivery instead of chasing work",
          "We could grow without it feeling like chaos",
          "We'd attract better talent, people would want to work here",
        ],
      },
      {
        id: "s4q2",
        question: "What would the ideal marketing partner do for you?",
        options: [
          "Take the whole thing off our plate",
          "Work alongside our team, fill the gaps we can't",
          "Give us a strategy and let us execute",
          "Help us figure out what we should even be doing",
          "All of the above, honestly",
        ],
      },
      {
        id: "s4q3",
        question: "What's stopped you from fixing this sooner?",
        options: [
          "We've tried agencies before and it didn't work out",
          "We kept thinking we'd get to it internally",
          "Budget, we weren't sure about the ROI",
          "We didn't know who to trust",
          "It's been on the list, we just needed the right push",
        ],
      },
      {
        id: "s4q4",
        question:
          "What does success look like for the business in the next 6–12 months?",
        options: [
          "Revenue growth, more sales, more clients",
          "Brand recognition, being known for what we do",
          "Operational clarity, less firefighting, more focus",
          "Market position, becoming the obvious choice in our space",
          "A bit of everything",
        ],
      },
      {
        id: "s4q5",
        question:
          "If we could change one thing about how the market sees your business, what should it be?",
        freeText: true,
        placeholder:
          "The gap between how good you are and how well-known you are.",
        charLimit: 400,
      },
      {
        id: "s4q6",
        tag: "practical_signal",
        question: "Do you currently have an email list or newsletter?",
        options: [
          "No, never set one up",
          "I've got one but I don't use it",
          "Yes, and I send to it occasionally",
          "Yes, and it's a regular thing",
        ],
      },
      {
        id: "s4q7",
        tag: "practical_signal",
        question:
          "Have you run paid ads before, Google, Meta, anything like that?",
        options: [
          "Never",
          "Tried it once, didn't stick",
          "Running some now, but I'm not confident they're working",
          "Running them and they're doing okay",
          "I've spent real money on ads, I know the basics",
        ],
      },
    ],
  },
  multi_stakeholder_company: {
    heading: "Where you want to be",
    subline: "Last section. This one's about what's next.",
    questions: [
      {
        id: "s4q1",
        question:
          "What would better marketing actually move for the business?",
        options: [
          "Pipeline, we need more qualified leads",
          "Brand, we need to be recognised, not just known",
          "Recruitment, we want the best people to want to work here",
          "Differentiation, we need to stand out from competitors",
          "Internal alignment, leadership wants a clearer story",
        ],
      },
      {
        id: "s4q2",
        question:
          "What does the ideal engagement look like for your team?",
        options: [
          "A partner who owns the strategy and execution",
          "A creative team that works with our internal people",
          "A project, deliver something specific and we'll take it from there",
          "We're still figuring out what we need",
          "It depends on what you show us first",
        ],
      },
      {
        id: "s4q3",
        question: "What's made this hard to get right in the past?",
        options: [
          "Too many stakeholders, too many opinions",
          "Agencies that didn't understand our business",
          "Internal teams that couldn't keep up",
          "Budget approved then pulled, stop-start cycle",
          "We've never really committed to it properly",
        ],
      },
      {
        id: "s4q4",
        question:
          "What does the leadership team care about most right now?",
        options: [
          "Growth, hitting revenue targets",
          "Efficiency, doing more with less",
          "Brand, being the name people think of first",
          "Innovation, launching something new",
          "People, attracting and keeping the right team",
        ],
      },
      {
        id: "s4q5",
        question:
          "What would make this investment feel like it was worth it, in the eyes of the people who approved it?",
        freeText: true,
        placeholder:
          'The thing that would make them say "that was a good call."',
        charLimit: 400,
      },
      {
        id: "s4q6",
        tag: "practical_signal",
        question: "Do you currently have an email list or newsletter?",
        options: [
          "No, never set one up",
          "I've got one but I don't use it",
          "Yes, and I send to it occasionally",
          "Yes, and it's a regular thing",
        ],
      },
      {
        id: "s4q7",
        tag: "practical_signal",
        question:
          "Have you run paid ads before, Google, Meta, anything like that?",
        options: [
          "Never",
          "Tried it once, didn't stick",
          "Running some now, but I'm not confident they're working",
          "Running them and they're doing okay",
          "I've spent real money on ads, I know the basics",
        ],
      },
    ],
  },
};

export function getSections(shape: Shape): SectionDef[] {
  return [section2[shape], section3[shape], section4[shape]];
}
