export const MANTRAS = [
  "The work works. You just show up.",
  "Revenue is a side effect of not being boring.",
  "Nobody got famous from a content calendar.",
  "Ship it. Fix it later. There is no later.",
  "Your competitors are in a meeting about this.",
  "Good enough is the enemy of done. Wait.",
  "The brief said 'bold'. The client meant 'blue'.",
  "Perfection is a stalling tactic with better PR.",
  "If it's not uncomfortable, it's not marketing.",
  "Three coffees in. Anything is possible.",
  "The market doesn't care about your feelings. Or your fonts.",
  "You didn't start a business to be reasonable.",
  "Every great campaign started as a bad idea nobody killed.",
  "The algorithm rewards the relentless. And the unhinged.",
  "Do the thing you're avoiding. It's the thing that matters.",
  "Comfort zones are where brands go to flatline.",
  "Make something worth stealing.",
  "Strategy without execution is just a PowerPoint.",
  "The inbox can wait. The idea can't.",
  "Be the brand that makes the other brands nervous.",
  "Less polish. More punch.",
  "Your best work happens when you stop trying to be safe.",
  "Trends expire. Taste doesn't.",
  "If everyone likes it, you've said nothing.",
  "Build the thing. Explain it later.",
  "Deadlines are just suggestions with consequences.",
  "Nobody remembers the version that played it safe.",
  "Stop optimising. Start making.",
  "The client's audience doesn't know what a brandmark is. And they're right.",
  "Today's to-do list is tomorrow's done list. Theoretically.",
] as const;

export function pickMantra(seedMs: number = Date.now()): string {
  const dayIndex = Math.floor(seedMs / 86400000);
  return MANTRAS[dayIndex % MANTRAS.length];
}

export const RANDOM_FACTS = [
  "Honey never spoils. Archaeologists found 3,000-year-old honey in Egyptian tombs and it was still edible.",
  "Octopuses have three hearts and blue blood.",
  "A group of flamingos is called a 'flamboyance'.",
  "Bananas are berries, but strawberries aren't.",
  "The shortest war in history lasted 38 minutes — Britain vs Zanzibar, 1896.",
  "Venus is the only planet that spins clockwise.",
  "There are more possible chess games than atoms in the observable universe.",
  "Scotland's national animal is the unicorn.",
  "A day on Venus is longer than a year on Venus.",
  "The inventor of the Pringles can is buried in one.",
  "Wombat poop is cube-shaped.",
  "The first computer programmer was Ada Lovelace, in 1843.",
  "Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.",
  "The total weight of all ants on Earth roughly equals the total weight of all humans.",
  "A jiffy is an actual unit of time — 1/100th of a second.",
] as const;

export function pickRandomFact(seedMs: number = Date.now()): string {
  const dayIndex = Math.floor(seedMs / 86400000);
  return RANDOM_FACTS[dayIndex % RANDOM_FACTS.length];
}

export const WORD_OF_THE_DAY = [
  { word: "Sonder", definition: "The realisation that each random passer-by is living a life as vivid and complex as your own." },
  { word: "Petrichor", definition: "The pleasant, earthy smell produced when rain falls on dry soil." },
  { word: "Hiraeth", definition: "A Welsh word for homesickness for a home you can't return to, or that never was." },
  { word: "Tsundoku", definition: "The art of buying books and letting them pile up unread." },
  { word: "Saudade", definition: "A deep emotional state of melancholic longing for something or someone absent." },
  { word: "Komorebi", definition: "Sunlight filtering through the leaves of trees." },
  { word: "Fernweh", definition: "An ache for distant places. The opposite of homesickness." },
  { word: "Meraki", definition: "Doing something with soul, creativity, or love — leaving a piece of yourself in your work." },
  { word: "Ubuntu", definition: "The belief in a universal bond of sharing that connects all humanity." },
  { word: "Wabi-sabi", definition: "Finding beauty in imperfection and accepting the natural cycle of growth and decay." },
  { word: "Flâneur", definition: "A person who walks the city in order to experience it. An urban explorer." },
  { word: "Eudaimonia", definition: "A Greek term for human flourishing — not happiness, but living well and doing well." },
  { word: "Bricolage", definition: "Creating something from a diverse range of whatever happens to be available." },
  { word: "Kairos", definition: "The perfect, opportune moment. The fleeting rightness of time." },
  { word: "Sprezzatura", definition: "A studied carelessness. Making the difficult look effortless." },
] as const;

export function pickWordOfTheDay(seedMs: number = Date.now()): { word: string; definition: string } {
  const dayIndex = Math.floor(seedMs / 86400000);
  return WORD_OF_THE_DAY[dayIndex % WORD_OF_THE_DAY.length];
}

export const THIS_DAY_IN_HISTORY = [
  "1953 — Edmund Hillary and Tenzing Norgay became the first climbers confirmed to have reached the summit of Everest.",
  "1969 — The internet's precursor, ARPANET, sent its first message from UCLA to Stanford.",
  "1977 — The Voyager 1 spacecraft launched, now the most distant human-made object in space.",
  "1991 — Tim Berners-Lee published the first website, launching the World Wide Web.",
  "1903 — The Wright Brothers flew for 12 seconds at Kitty Hawk. It was enough.",
  "1962 — John Glenn orbited the Earth. He came back and became a senator. Overachiever.",
  "1984 — Apple aired the '1984' Super Bowl ad. Marketing hasn't been the same since.",
  "2007 — Steve Jobs introduced the iPhone. The world pretended to be unimpressed for about six hours.",
  "1859 — Charles Darwin published On the Origin of Species. Some people are still catching up.",
  "1928 — Alexander Fleming discovered penicillin by accident. The universe rewards the messy.",
  "1957 — Sputnik launched. A metal ball that beeped changed everything.",
  "1969 — Apollo 11 landed on the Moon. Armstrong's line was good but Aldrin's view was better.",
  "1989 — The Berlin Wall fell. Turns out walls have a shelf life.",
  "2001 — Wikipedia launched. Knowledge became free and arguments became infinite.",
  "1994 — Nelson Mandela was inaugurated as South Africa's president. Patience measured in decades.",
] as const;

export function pickThisDayInHistory(seedMs: number = Date.now()): string {
  const dayIndex = Math.floor(seedMs / 86400000);
  return THIS_DAY_IN_HISTORY[dayIndex % THIS_DAY_IN_HISTORY.length];
}

export type RotatingCardType = "mantra" | "random_fact" | "word_of_the_day" | "this_day_in_history";

export function pickRotatingCard(seedMs: number = Date.now()): {
  type: RotatingCardType;
  content: string;
  subtitle?: string;
} {
  const dayIndex = Math.floor(seedMs / 86400000);
  const cardType = dayIndex % 4;

  switch (cardType) {
    case 0:
      return { type: "mantra", content: pickMantra(seedMs) };
    case 1: {
      const fact = pickRandomFact(seedMs);
      return { type: "random_fact", content: fact };
    }
    case 2: {
      const word = pickWordOfTheDay(seedMs);
      return { type: "word_of_the_day", content: word.word, subtitle: word.definition };
    }
    case 3:
      return { type: "this_day_in_history", content: pickThisDayInHistory(seedMs) };
    default:
      return { type: "mantra", content: pickMantra(seedMs) };
  }
}
