"use client";

import { PublicEggOrchestrator } from "./public-egg-orchestrator";
import {
  LateNightVisitorEgg,
  SundayResearcherEgg,
  FifthTimeVisitorEgg,
  ReturningVisitorEgg,
  LinkedInReferrerEgg,
  GoogleIntentCheapEgg,
  RapidScrollerEgg,
  DeepReaderEgg,
  AbandonedTabEgg,
} from "./public-egg-renderers";
import { MelbourneRainEgg } from "./melbourne-rain-egg";
import { PublicCrtTurnOffEgg } from "./public-crt-turn-off-egg";
import { WelcomeEggSafetyNet } from "./welcome-egg-safety-net";

export function PublicEggShell() {
  return (
    <>
      <PublicEggOrchestrator />
      <LateNightVisitorEgg />
      <SundayResearcherEgg />
      <FifthTimeVisitorEgg />
      <ReturningVisitorEgg />
      <LinkedInReferrerEgg />
      <GoogleIntentCheapEgg />
      <RapidScrollerEgg />
      <DeepReaderEgg />
      <AbandonedTabEgg />
      <MelbourneRainEgg />
      <PublicCrtTurnOffEgg />
      <WelcomeEggSafetyNet />
    </>
  );
}
