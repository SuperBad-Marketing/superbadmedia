/**
 * Seed the brand_voice_examples table with outreach voice anchors.
 * Clears existing outreach examples first.
 *
 * Usage:
 *   NODE_OPTIONS='-r ./scripts/shim-server-only.cjs' npx tsx scripts/seed-brand-voice-examples.ts
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { brand_voice_examples } from "../lib/db/schema/brand-voice-examples";

const EXAMPLES = [
  {
    title: "First touch — café owner",
    body_markdown: `**Subject:** your google reviews vs your instagram

Hey Sarah,

You've got a bunch of really positive Google reviews — people clearly love the place. But your Instagram hasn't posted in months and your website's still showing an old menu.

I know you didn't ask for my opinion — occupational hazard, I stare at this stuff all day — but the easiest thing you could do is grab a few of those Google reviews where someone mentions a specific dish or moment, and post them as carousels. Your customers already wrote the copy for you.

I run a small marketing company in Melbourne. Mostly I just help businesses that are better in person than they are online. We do a trial shoot — 60 minutes, $397, you get photos, a video, and a 6-week plan whether you hire us or not.

Worth a conversation if you're curious. No stress if not.

Andy`,
  },
  {
    title: "Second touch — tradie",
    body_markdown: `**Subject:** quick thought about Davies Electrical

Mark,

Hope you don't mind me saying — your Google listing says you do commercial and residential but all the photos look like house renos. If I'm a business owner looking for a sparky, nothing on there tells me you handle that kind of work.

I only mention it because it's a genuinely easy fix. Even a few phone photos from your next commercial job would do it. Not exactly groundbreaking advice, but sometimes the obvious stuff just gets missed when you're busy actually doing the work.

superbadmedia.com.au if you want to see what we do.

Andy`,
  },
  {
    title: "Third touch — proof from similar business",
    body_markdown: `**Subject:** something worth mentioning

Sarah,

We worked with a café in a similar spot — great reputation, dead online presence. Within about six weeks their Instagram was actually driving walk-ins. The owner told me it was the first time her marketing looked like the business felt. Which is a nicer way of saying her old stuff was terrible.

Might be relevant to you, might not. Either way, the offer's there.

Andy`,
  },
  {
    title: "Fourth touch — breakup",
    body_markdown: `**Subject:** last one from me

Sarah,

Last email. I'll stop cluttering your inbox. If the timing's ever right, you know where to find me.

Andy`,
  },
  {
    title: "Bonus touch — opened, never replied",
    body_markdown: `**Subject:** sarah

You've opened a couple of these so I figure you're at least a bit curious. Or just too polite to unsubscribe. Either way I respect it.

If there's a reason you haven't replied — wrong time, not interested, whatever — genuinely all good. But if you just haven't got around to it, this is the nudge.

superbadmedia.com.au/trial-shoot if you want to see what the trial shoot actually is.

Andy`,
  },
];

async function main() {
  const deleted = await db
    .delete(brand_voice_examples)
    .where(eq(brand_voice_examples.surface, "outreach"));

  console.log(`Cleared existing outreach examples.`);

  const now = Date.now();
  for (let i = 0; i < EXAMPLES.length; i++) {
    const ex = EXAMPLES[i];
    await db.insert(brand_voice_examples).values({
      id: randomUUID(),
      surface: "outreach",
      title: ex.title,
      body_markdown: ex.body_markdown,
      sort_order: i,
      created_at_ms: now,
      updated_at_ms: now,
    });
    console.log(`✓ ${ex.title}`);
  }

  console.log(`\nSeeded ${EXAMPLES.length} outreach voice examples.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
