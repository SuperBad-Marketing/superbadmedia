import { execSync, exec as execCb } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { clientService, type ReferenceReel } from './clients.js'
import { dataPath } from './dataRoot.js'

const exec = promisify(execCb)

const REELS_DIR = dataPath('.reference-reels')
fs.mkdirSync(REELS_DIR, { recursive: true })

function reelPath(clientId: string, reelId: string): string {
  const dir = path.join(REELS_DIR, clientId)
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, `${reelId}.mp4`)
}

async function downloadReel(url: string, outputPath: string): Promise<void> {
  await exec(
    `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputPath}" "${url}"`,
    { timeout: 120000 },
  )
}

async function detectScenes(videoPath: string): Promise<number[]> {
  const { stdout } = await exec(
    `ffprobe -v quiet -show_entries frame=pts_time -of csv=p=0 -f lavfi "movie='${videoPath.replace(/'/g, "'\\''")}',select='gt(scene\\,0.3)'"`,
    { timeout: 60000 },
  )
  return stdout.trim().split('\n').filter(Boolean).map(Number).filter(n => !isNaN(n))
}

async function getDuration(videoPath: string): Promise<number> {
  const { stdout } = await exec(
    `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${videoPath}"`,
  )
  return parseFloat(stdout.trim()) || 0
}

async function extractFrames(videoPath: string, timestamps: number[]): Promise<string[]> {
  const framePaths: string[] = []
  const tmpDir = path.join(REELS_DIR, '.tmp-frames')
  fs.mkdirSync(tmpDir, { recursive: true })

  const selected = timestamps.length <= 6
    ? timestamps
    : timestamps.filter((_, i) => i % Math.ceil(timestamps.length / 6) === 0).slice(0, 6)

  for (let i = 0; i < selected.length; i++) {
    const framePath = path.join(tmpDir, `frame-${Date.now()}-${i}.jpg`)
    try {
      await exec(
        `ffmpeg -y -ss ${selected[i]} -i "${videoPath}" -frames:v 1 -q:v 2 "${framePath}"`,
        { timeout: 10000 },
      )
      framePaths.push(framePath)
    } catch {}
  }
  return framePaths
}

async function analyzeWithVision(
  framePaths: string[],
  sceneTimestamps: number[],
  totalDuration: number,
): Promise<ReferenceReel['analysis']> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return buildFallbackAnalysis(sceneTimestamps, totalDuration)
  }

  const client = new Anthropic({ apiKey })

  const imageContent: Anthropic.ImageBlockParam[] = framePaths
    .filter(fp => fs.existsSync(fp))
    .map(fp => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: fs.readFileSync(fp).toString('base64'),
      },
    }))

  const cutLengths = computeCutLengths(sceneTimestamps, totalDuration)
  const avgCut = cutLengths.length > 0 ? cutLengths.reduce((a, b) => a + b, 0) / cutLengths.length : totalDuration

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `You analyze reference reels for a video editing assistant. Given keyframes and edit metrics, describe the editing style.

Respond with ONLY a JSON object:
{
  "rhythmPattern": ["staccato", "held", "cascade", ...],
  "hasText": boolean,
  "hasFaceCam": boolean,
  "dominantColors": ["#hex", ...],
  "transitionTypes": ["hard-cut", "whip-pan", "dissolve", ...],
  "pacing": "fast"|"medium"|"slow",
  "notes": "1-2 sentence style description"
}`,
    messages: [{
      role: 'user',
      content: [
        ...imageContent,
        {
          type: 'text',
          text: `This reel is ${totalDuration.toFixed(1)}s long with ${sceneTimestamps.length} cuts (avg ${avgCut.toFixed(1)}s per cut). Cut lengths: ${cutLengths.map(c => c.toFixed(1)).join(', ')}s. Analyze the editing style.`,
        },
      ],
    }],
  })

  const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
  const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}')

  const energyCurve = computeEnergyCurve(cutLengths)

  return {
    totalDuration,
    cutCount: sceneTimestamps.length,
    avgCutLength: avgCut,
    cutLengths,
    rhythmPattern: parsed.rhythmPattern || [],
    energyCurve,
    hasText: parsed.hasText ?? false,
    hasFaceCam: parsed.hasFaceCam ?? false,
    dominantColors: parsed.dominantColors || [],
    transitionTypes: parsed.transitionTypes || ['hard-cut'],
    pacing: parsed.pacing || (avgCut < 2 ? 'fast' : avgCut < 4 ? 'medium' : 'slow'),
    notes: parsed.notes || '',
  }
}

function computeCutLengths(timestamps: number[], totalDuration: number): number[] {
  if (timestamps.length === 0) return [totalDuration]
  const sorted = [0, ...timestamps.sort((a, b) => a - b), totalDuration]
  const lengths: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const len = sorted[i] - sorted[i - 1]
    if (len > 0.1) lengths.push(len)
  }
  return lengths
}

function computeEnergyCurve(cutLengths: number[]): number[] {
  if (cutLengths.length === 0) return [50]
  const maxCut = Math.max(...cutLengths)
  return cutLengths.map(c => Math.round((1 - c / maxCut) * 100))
}

function buildFallbackAnalysis(sceneTimestamps: number[], totalDuration: number): ReferenceReel['analysis'] {
  const cutLengths = computeCutLengths(sceneTimestamps, totalDuration)
  const avgCut = cutLengths.length > 0 ? cutLengths.reduce((a, b) => a + b, 0) / cutLengths.length : totalDuration

  return {
    totalDuration,
    cutCount: sceneTimestamps.length,
    avgCutLength: avgCut,
    cutLengths,
    rhythmPattern: [],
    energyCurve: computeEnergyCurve(cutLengths),
    hasText: false,
    hasFaceCam: false,
    dominantColors: [],
    transitionTypes: ['hard-cut'],
    pacing: avgCut < 2 ? 'fast' : avgCut < 4 ? 'medium' : 'slow',
    notes: '',
  }
}

export async function analyzeReel(clientId: string, reelId: string, url: string): Promise<void> {
  const videoPath = reelPath(clientId, reelId)

  try {
    await downloadReel(url, videoPath)

    clientService.updateReelLocalPath(clientId, reelId, videoPath)

    const [sceneTimestamps, totalDuration] = await Promise.all([
      detectScenes(videoPath),
      getDuration(videoPath),
    ])

    const framePaths = await extractFrames(videoPath, [0, ...sceneTimestamps])

    const analysis = await analyzeWithVision(framePaths, sceneTimestamps, totalDuration)

    clientService.updateReelAnalysis(clientId, reelId, analysis)

    for (const fp of framePaths) {
      try { fs.unlinkSync(fp) } catch {}
    }
  } catch (err: any) {
    console.error(`Reel analysis failed for ${reelId}:`, err.message)
  }
}
