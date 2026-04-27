import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import type { SfxName, SfxCueData, MotionTemplateProps } from "../types";

const SFX_FILES: Record<SfxName, string> = {
  tick: "sfx/tick.wav",
  whoosh: "sfx/whoosh.wav",
  impact: "sfx/impact.wav",
  riser: "sfx/riser.wav",
};

export const SfxCue: React.FC<{
  sfx: SfxName;
  startFrame: number;
  volume?: number;
}> = ({ sfx, startFrame, volume = 0.6 }) => (
  <Sequence from={startFrame} layout="none">
    <Audio src={staticFile(SFX_FILES[sfx])} volume={volume} />
  </Sequence>
);

export const SfxLayer: React.FC<{ cues: SfxCueData[] }> = ({ cues }) => (
  <>
    {cues.map((cue, i) => (
      <SfxCue key={i} sfx={cue.sfx} startFrame={cue.startFrame} volume={cue.volume} />
    ))}
  </>
);

export function withSfx(
  Component: React.FC<MotionTemplateProps>,
): React.FC<MotionTemplateProps> {
  const Wrapped: React.FC<MotionTemplateProps> = (props) => (
    <>
      <Component {...props} />
      {props.sfxCues && props.sfxCues.length > 0 && (
        <SfxLayer cues={props.sfxCues} />
      )}
    </>
  );
  return Wrapped;
}
