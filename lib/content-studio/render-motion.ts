import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { MOTION_DIMENSIONS, type MotionAspectRatio } from "./motion/types";
import type { ColourPalette, SfxCueData } from "./motion/types";

export type MotionFormat = "mp4" | "webm";

export interface MotionRenderInput {
  templateId: string;
  copy: Record<string, string>;
  palette: ColourPalette;
  aspectRatio: MotionAspectRatio;
  transparent: boolean;
  animationParams: Record<string, number | string | boolean>;
  durationInFrames: number;
  format: MotionFormat;
  fontPairingId?: string;
  sfxCues?: SfxCueData[];
}

export interface MotionRenderResult {
  filePath: string;
  width: number;
  height: number;
  format: MotionFormat;
}

let bundlePromise: Promise<string> | null = null;

async function getBundlePath(): Promise<string> {
  if (!bundlePromise) {
    bundlePromise = bundle({
      entryPoint: join(process.cwd(), "remotion/index.ts"),
      webpackOverride: (config) => config,
    });
  }
  return bundlePromise;
}

export async function renderMotionPost(
  input: MotionRenderInput,
): Promise<MotionRenderResult> {
  const { width, height } = MOTION_DIMENSIONS[input.aspectRatio];
  const bundlePath = await getBundlePath();

  const composition = await selectComposition({
    serveUrl: bundlePath,
    id: input.templateId,
    inputProps: {
      copy: input.copy,
      palette: input.palette,
      transparent: input.transparent,
      animationParams: input.animationParams,
      fontPairingId: input.fontPairingId,
      sfxCues: input.sfxCues,
    },
  });

  const outputPath = join(
    tmpdir(),
    `motion-${input.templateId}-${Date.now()}.${input.format}`,
  );

  await renderMedia({
    composition: {
      ...composition,
      width,
      height,
      durationInFrames: input.durationInFrames,
    },
    serveUrl: bundlePath,
    codec: input.format === "webm" ? "vp8" : "h264",
    outputLocation: outputPath,
    inputProps: {
      copy: input.copy,
      palette: input.palette,
      transparent: input.transparent,
      animationParams: input.animationParams,
      fontPairingId: input.fontPairingId,
      sfxCues: input.sfxCues,
    },
    ...(input.transparent && input.format === "webm"
      ? { pixelFormat: "yuva420p" }
      : {}),
  });

  return { filePath: outputPath, width, height, format: input.format };
}

export async function renderAndUploadMotion(
  input: MotionRenderInput,
  postId: string,
  ratioLabel: string,
): Promise<{
  publicId: string;
  url: string;
  width: number;
  height: number;
  format: MotionFormat;
}> {
  const result = await renderMotionPost(input);

  try {
    const upload = await uploadToCloudinary(
      result.filePath,
      `superbad/content-studio/${postId}/motion`,
      { resourceType: "video" },
    );
    return {
      publicId: upload.public_id,
      url: upload.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
    };
  } finally {
    await unlink(result.filePath).catch(() => {});
  }
}
