import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'

const execAsync = promisify(exec)

const DOLBY_API_BASE = 'https://api.dolby.com'

interface AudioCleanupResult {
  outputPath: string
  applied: string[]
  skipped: boolean
}

async function getDolbyToken(): Promise<string> {
  const apiKey = process.env.DOLBY_API_KEY
  if (!apiKey) throw new Error('Dolby API key not configured. Add it in Settings.')
  return apiKey
}

async function analyzeAudioQuality(filePath: string): Promise<{
  hasAudio: boolean
  noiseLevel: 'clean' | 'moderate' | 'noisy'
  peakDb: number
  needsCleanup: boolean
}> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_streams -select_streams a "${filePath}"`,
      { timeout: 15000 },
    )
    const probe = JSON.parse(stdout)
    const audioStream = probe.streams?.[0]

    if (!audioStream) {
      return { hasAudio: false, noiseLevel: 'clean', peakDb: -96, needsCleanup: false }
    }

    const { stdout: volumeOut } = await execAsync(
      `ffmpeg -i "${filePath}" -af "volumedetect" -f null /dev/null 2>&1 | grep -E "mean_volume|max_volume"`,
      { timeout: 30000 },
    )

    let meanDb = -30
    let maxDb = -6
    const meanMatch = volumeOut.match(/mean_volume:\s*([-\d.]+)/)
    const maxMatch = volumeOut.match(/max_volume:\s*([-\d.]+)/)
    if (meanMatch) meanDb = parseFloat(meanMatch[1])
    if (maxMatch) maxDb = parseFloat(maxMatch[1])

    const noiseDiff = maxDb - meanDb
    let noiseLevel: 'clean' | 'moderate' | 'noisy' = 'clean'
    if (noiseDiff < 10) noiseLevel = 'noisy'
    else if (noiseDiff < 20) noiseLevel = 'moderate'

    return {
      hasAudio: true,
      noiseLevel,
      peakDb: maxDb,
      needsCleanup: noiseLevel !== 'clean',
    }
  } catch {
    return { hasAudio: false, noiseLevel: 'clean', peakDb: -96, needsCleanup: false }
  }
}

export async function cleanupAudioDolby(
  inputPath: string,
  outputDir: string,
): Promise<AudioCleanupResult> {
  const token = await getDolbyToken()
  const fileName = path.basename(inputPath, path.extname(inputPath))
  const outputPath = path.join(outputDir, `${fileName}_cleaned.wav`)
  const applied: string[] = []

  const analysis = await analyzeAudioQuality(inputPath)
  if (!analysis.hasAudio || !analysis.needsCleanup) {
    return { outputPath: inputPath, applied: [], skipped: true }
  }

  // Upload to Dolby for processing
  const inputUpload = await fetch(`${DOLBY_API_BASE}/media/input`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: `dlb://superedits/${fileName}` }),
  })

  if (!inputUpload.ok) {
    throw new Error(`Dolby upload init failed: ${inputUpload.statusText}`)
  }

  const { url: presignedUrl } = await inputUpload.json()

  const fileBuffer = await fs.readFile(inputPath)
  const uploadRes = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: fileBuffer,
  })

  if (!uploadRes.ok) {
    throw new Error(`Dolby file upload failed: ${uploadRes.statusText}`)
  }

  // Start enhance job
  const enhanceConfig: Record<string, any> = {
    input: `dlb://superedits/${fileName}`,
    output: `dlb://superedits/${fileName}_enhanced`,
    content: { type: 'voice_recording' },
    audio: {
      noise: { reduction: { enable: true } },
      loudness: { enable: true, dialog_intelligence: true },
    },
  }

  if (analysis.noiseLevel === 'noisy') {
    enhanceConfig.audio.dynamics = { range_control: { enable: true } }
    applied.push('noise-reduction', 'loudness', 'dynamic-range')
  } else {
    applied.push('noise-reduction', 'loudness')
  }

  const enhanceRes = await fetch(`${DOLBY_API_BASE}/media/enhance`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(enhanceConfig),
  })

  if (!enhanceRes.ok) {
    throw new Error(`Dolby enhance failed: ${enhanceRes.statusText}`)
  }

  const { job_id } = await enhanceRes.json()

  // Poll for completion
  let status = 'Running'
  let attempts = 0
  while (status === 'Running' && attempts < 120) {
    await new Promise(r => setTimeout(r, 2000))
    const statusRes = await fetch(`${DOLBY_API_BASE}/media/enhance?job_id=${job_id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    const statusData = await statusRes.json()
    status = statusData.status
    attempts++
  }

  if (status !== 'Success') {
    throw new Error(`Dolby enhance job failed with status: ${status}`)
  }

  // Download enhanced audio
  const downloadRes = await fetch(`${DOLBY_API_BASE}/media/output`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  // For the actual download we need the output URL
  const downloadUrl = await fetch(`${DOLBY_API_BASE}/media/output?url=${encodeURIComponent(`dlb://superedits/${fileName}_enhanced`)}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })

  if (!downloadUrl.ok) {
    throw new Error(`Dolby download failed: ${downloadUrl.statusText}`)
  }

  const audioBuffer = Buffer.from(await downloadUrl.arrayBuffer())
  await fs.writeFile(outputPath, audioBuffer)

  return { outputPath, applied, skipped: false }
}

export async function cleanupAudioLocal(
  inputPath: string,
  outputDir: string,
): Promise<AudioCleanupResult> {
  const fileName = path.basename(inputPath, path.extname(inputPath))
  const outputPath = path.join(outputDir, `${fileName}_cleaned.wav`)
  const applied: string[] = []

  const analysis = await analyzeAudioQuality(inputPath)
  if (!analysis.hasAudio || !analysis.needsCleanup) {
    return { outputPath: inputPath, applied: [], skipped: true }
  }

  const filters: string[] = []

  if (analysis.noiseLevel === 'noisy') {
    filters.push('highpass=f=80')
    filters.push('lowpass=f=12000')
    filters.push('afftdn=nf=-25')
    applied.push('high-pass', 'low-pass', 'fft-denoise')
  } else if (analysis.noiseLevel === 'moderate') {
    filters.push('highpass=f=60')
    filters.push('afftdn=nf=-20')
    applied.push('high-pass', 'fft-denoise')
  }

  filters.push('loudnorm=I=-16:TP=-1.5:LRA=11')
  applied.push('loudness-normalisation')

  const filterChain = filters.join(',')

  await execAsync(
    `ffmpeg -y -i "${inputPath}" -af "${filterChain}" -ar 48000 -ac 2 "${outputPath}"`,
    { timeout: 120000 },
  )

  return { outputPath, applied, skipped: false }
}

export async function cleanupAudio(
  inputPath: string,
  outputDir: string,
): Promise<AudioCleanupResult> {
  if (process.env.DOLBY_API_KEY) {
    try {
      return await cleanupAudioDolby(inputPath, outputDir)
    } catch {
      return await cleanupAudioLocal(inputPath, outputDir)
    }
  }
  return await cleanupAudioLocal(inputPath, outputDir)
}

export { analyzeAudioQuality }
export function isDolbyConfigured(): boolean {
  return !!process.env.DOLBY_API_KEY
}
