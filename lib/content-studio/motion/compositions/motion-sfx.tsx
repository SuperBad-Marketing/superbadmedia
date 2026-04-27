import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import type { SfxCueData, MotionTemplateProps } from "../types";

export const SfxCue: React.FC<{
  url: string;
  startFrame: number;
  volume?: number;
}> = ({ url, startFrame, volume = 0.6 }) => {
  const src = url.startsWith("http") ? url : staticFile(url);
  return (
    <Sequence from={startFrame} layout="none">
      <Audio src={src} volume={volume} />
    </Sequence>
  );
};

export const SfxLayer: React.FC<{ cues: SfxCueData[] }> = ({ cues }) => (
  <>
    {cues.map((cue, i) => (
      <SfxCue key={i} url={cue.url} startFrame={cue.startFrame} volume={cue.volume} />
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
