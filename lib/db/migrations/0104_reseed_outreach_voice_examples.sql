-- Replace robotic seed examples with personable, self-deprecating versions
-- that match Andy's actual voice. Old seeds had precise stat-counting
-- ("94 reviews", "4.8 stars") and wrong pricing ($297). New examples
-- use natural language, ask permission before offering advice, and
-- reference correct trial shoot pricing ($397).

-- Remove old seeds + UI-added duplicates (same content, carried forward here)
DELETE FROM brand_voice_examples WHERE surface = 'outreach' AND id NOT LIKE 'outreach-v2-%';

-- Insert updated examples (varied prospects, natural voice)
INSERT OR REPLACE INTO brand_voice_examples (id, surface, title, body_markdown, sort_order, created_at_ms, updated_at_ms)
VALUES (
  'outreach-v2-touch1-cafe',
  'outreach',
  'First touch — café owner',
  '**Subject:** your google reviews vs your instagram

Hey Sarah,

You''ve got a bunch of really positive Google reviews — people clearly love the place. But your Instagram hasn''t posted in months and your website''s still showing an old menu.

I know you didn''t ask for my opinion — occupational hazard, I stare at this stuff all day — but the easiest thing you could do is grab a few of those Google reviews where someone mentions a specific dish or moment, and post them as carousels. Your customers already wrote the copy for you.

I run a small marketing company in Melbourne. Mostly I just help businesses that are better in person than they are online. We do a trial shoot — 60 minutes, $397, you get photos, a video, and a 6-week plan whether you hire us or not.

Worth a conversation if you''re curious. No stress if not.

Andy',
  1,
  1745712000000,
  1745712000000
);

INSERT OR REPLACE INTO brand_voice_examples (id, surface, title, body_markdown, sort_order, created_at_ms, updated_at_ms)
VALUES (
  'outreach-v2-touch2-tradie',
  'outreach',
  'Second touch — tradie',
  '**Subject:** quick thought about Davies Electrical

Mark,

Hope you don''t mind me saying — your Google listing says you do commercial and residential but all the photos look like house renos. If I''m a business owner looking for a sparky, nothing on there tells me you handle that kind of work.

I only mention it because it''s a genuinely easy fix. Even a few phone photos from your next commercial job would do it. Not exactly groundbreaking advice, but sometimes the obvious stuff just gets missed when you''re busy actually doing the work.

superbadmedia.com.au if you want to see what we do.

Andy',
  2,
  1745712000000,
  1745712000000
);

INSERT OR REPLACE INTO brand_voice_examples (id, surface, title, body_markdown, sort_order, created_at_ms, updated_at_ms)
VALUES (
  'outreach-v2-touch3-proof',
  'outreach',
  'Third touch — proof from similar business',
  '**Subject:** something worth mentioning

Sarah,

We worked with a café in a similar spot — great reputation, dead online presence. Within about six weeks their Instagram was actually driving walk-ins. The owner told me it was the first time her marketing looked like the business felt. Which is a nicer way of saying her old stuff was terrible.

Might be relevant to you, might not. Either way, the offer''s there.

Andy',
  3,
  1745712000000,
  1745712000000
);

INSERT OR REPLACE INTO brand_voice_examples (id, surface, title, body_markdown, sort_order, created_at_ms, updated_at_ms)
VALUES (
  'outreach-v2-touch4-breakup',
  'outreach',
  'Fourth touch — breakup',
  '**Subject:** last one from me

Sarah,

Last email. I''ll stop cluttering your inbox. If the timing''s ever right, you know where to find me.

Andy',
  4,
  1745712000000,
  1745712000000
);

INSERT OR REPLACE INTO brand_voice_examples (id, surface, title, body_markdown, sort_order, created_at_ms, updated_at_ms)
VALUES (
  'outreach-v2-touch5-bonus',
  'outreach',
  'Bonus touch — opened, never replied',
  '**Subject:** sarah

You''ve opened a couple of these so I figure you''re at least a bit curious. Or just too polite to unsubscribe. Either way I respect it.

If there''s a reason you haven''t replied — wrong time, not interested, whatever — genuinely all good. But if you just haven''t got around to it, this is the nudge.

superbadmedia.com.au/trial-shoot if you want to see what the trial shoot actually is.

Andy',
  5,
  1745712000000,
  1745712000000
);
