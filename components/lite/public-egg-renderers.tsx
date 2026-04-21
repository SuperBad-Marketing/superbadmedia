"use client";

import { PublicEggMarginNote } from "./public-egg-margin-note";

export function LateNightVisitorEgg() {
  return (
    <PublicEggMarginNote eggId="late_night_visitor" placement="top">
      it&rsquo;s 3am where you are. genuinely, go to bed.
    </PublicEggMarginNote>
  );
}

export function SundayResearcherEgg() {
  return (
    <PublicEggMarginNote eggId="sunday_researcher" placement="hero">
      sunday. you&rsquo;re researching marketing agencies on a sunday. we&rsquo;re a bit worried about you.
    </PublicEggMarginNote>
  );
}

export function FifthTimeVisitorEgg() {
  return (
    <PublicEggMarginNote eggId="fifth_time_visitor" placement="content">
      you keep coming back. if you&rsquo;d like to actually talk to someone,{" "}
      <a
        href="mailto:andy@superbadmedia.com.au"
        className="underline decoration-1 underline-offset-2"
        style={{ color: "inherit" }}
      >
        andy@superbadmedia.com.au
      </a>
    </PublicEggMarginNote>
  );
}

export function ReturningVisitorEgg() {
  return (
    <PublicEggMarginNote eggId="returning_visitor" placement="footer">
      you&rsquo;re back. we didn&rsquo;t do anything with the place.
    </PublicEggMarginNote>
  );
}

export function LinkedInReferrerEgg() {
  return (
    <PublicEggMarginNote eggId="linkedin_referrer" placement="hero">
      LinkedIn sent you here. we are, in a sense, sorry.
    </PublicEggMarginNote>
  );
}

export function GoogleIntentCheapEgg() {
  return (
    <PublicEggMarginNote eggId="google_intent_cheap" placement="hero">
      we&rsquo;re not cheap. we&rsquo;re sorry. there&rsquo;s a door over there.
    </PublicEggMarginNote>
  );
}

export function RapidScrollerEgg() {
  return (
    <PublicEggMarginNote eggId="rapid_scroller" placement="bottom">
      you scrolled past it in six seconds. here&rsquo;s the short version: we do marketing. properly.
    </PublicEggMarginNote>
  );
}

export function DeepReaderEgg() {
  return (
    <PublicEggMarginNote eggId="deep_reader" placement="content">
      you actually read it. that&rsquo;s rare.
    </PublicEggMarginNote>
  );
}

export function AbandonedTabEgg() {
  return (
    <PublicEggMarginNote eggId="abandoned_tab" placement="top">
      you opened us in a new tab and walked away. it&rsquo;s fine. we&rsquo;ll wait.
    </PublicEggMarginNote>
  );
}
