import { execSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'

const WHISPER_VENV = path.join(os.homedir(), '.local', 'whisper-venv', 'bin', 'whisper')

export interface Caption {
  id: string
  startTime: number
  endTime: number
  text: string
}

export interface CaptionStyle {
  font: string
  size: number
  color: string
  position: 'bottom' | 'center' | 'top'
  background: boolean
  animation: 'none' | 'fade' | 'pop' | 'typewriter'
}

export interface TranscribeResult {
  captions: Caption[]
  method: 'whisper' | 'silence-detection' | 'placeholder'
}

export class CaptionService {
  async transcribe(filePath: string): Promise<TranscribeResult> {
    const audioPath = `/tmp/superedits-audio-${crypto.randomUUID()}.wav`
    try {
      execSync(
        `ffmpeg -y -i "${filePath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}"`,
        { timeout: 60000, stdio: 'pipe' }
      )

      const whisperCaptions = this.tryWhisper(audioPath)
      if (whisperCaptions.length > 0) {
        this.cleanup(audioPath)
        return { captions: whisperCaptions, method: 'whisper' }
      }

      const captions = this.segmentByEnergy(filePath, audioPath)
      this.cleanup(audioPath)
      if (captions.length > 0 && !captions[0].text.startsWith('[Caption')) {
        return { captions, method: 'silence-detection' }
      }
      return { captions, method: captions.length > 0 ? 'silence-detection' : 'placeholder' }
    } catch (err: any) {
      console.error('Transcription failed:', err.message)
      this.cleanup(audioPath)
      return { captions: this.generatePlaceholderCaptions(filePath), method: 'placeholder' }
    }
  }

  private tryWhisper(audioPath: string): Caption[] {
    // Try whisper CLI (Python package: pip install openai-whisper)
    try {
      const whisperBin = fs.existsSync(WHISPER_VENV) ? WHISPER_VENV : 'whisper'
      execSync(
        `"${whisperBin}" "${audioPath}" --model tiny --language en --output_format json --output_dir /tmp 2>/dev/null`,
        { encoding: 'utf-8', timeout: 120000 }
      )
      // whisper outputs a .json file next to the input
      const jsonPath = audioPath.replace('.wav', '.json')
      if (fs.existsSync(jsonPath)) {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
        const captions = data.segments.map((seg: any) => ({
          id: crypto.randomUUID(),
          startTime: Math.round(seg.start * 100) / 100,
          endTime: Math.round(seg.end * 100) / 100,
          text: seg.text.trim(),
        }))
        try { fs.unlinkSync(jsonPath) } catch {}
        return captions
      }
    } catch {}

    // Try whisper-cpp if installed
    try {
      execSync(
        `which whisper-cpp 2>/dev/null || which whisper.cpp 2>/dev/null || which main 2>/dev/null`,
        { encoding: 'utf-8', timeout: 5000 }
      ).trim()
      // whisper-cpp exists but we'd need the model path — skip for now
    } catch {}

    return []
  }

  private cleanup(audioPath: string) {
    try { fs.unlinkSync(audioPath) } catch {}
  }

  private segmentByEnergy(videoPath: string, audioPath: string): Caption[] {
    try {
      const silenceOutput = execSync(
        `ffmpeg -i "${audioPath}" -af silencedetect=noise=-30dB:d=0.5 -f null - 2>&1`,
        { encoding: 'utf-8', timeout: 30000 }
      )

      const silenceEnds: number[] = []
      const silenceStarts: number[] = []
      const endRegex = /silence_end: ([\d.]+)/g
      const startRegex = /silence_start: ([\d.]+)/g

      let match
      while ((match = endRegex.exec(silenceOutput)) !== null) {
        silenceEnds.push(parseFloat(match[1]))
      }
      while ((match = startRegex.exec(silenceOutput)) !== null) {
        silenceStarts.push(parseFloat(match[1]))
      }

      const captions: Caption[] = []
      const segments: [number, number][] = []

      if (silenceEnds.length > 0) {
        segments.push([0, silenceStarts[0] || silenceEnds[0]])

        for (let i = 0; i < silenceEnds.length; i++) {
          const start = silenceEnds[i]
          const end = i + 1 < silenceStarts.length ? silenceStarts[i + 1] : start + 3
          if (end - start > 0.3) {
            segments.push([start, Math.min(end, start + 5)])
          }
        }
      }

      for (const [start, end] of segments) {
        captions.push({
          id: crypto.randomUUID(),
          startTime: Math.round(start * 100) / 100,
          endTime: Math.round(end * 100) / 100,
          text: `[Speech segment ${captions.length + 1}]`,
        })
      }

      return captions.length > 0 ? captions : this.generatePlaceholderCaptions(videoPath)
    } catch {
      return this.generatePlaceholderCaptions(videoPath)
    }
  }

  private generatePlaceholderCaptions(filePath: string): Caption[] {
    let duration = 30
    try {
      const probeResult = execSync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
        { encoding: 'utf-8', timeout: 10000 }
      )
      duration = parseFloat(probeResult.trim()) || 30
    } catch {}

    const captions: Caption[] = []
    const segmentLength = 3
    for (let t = 0; t < duration; t += segmentLength + 1) {
      captions.push({
        id: crypto.randomUUID(),
        startTime: t,
        endTime: Math.min(t + segmentLength, duration),
        text: `[Caption ${captions.length + 1}]`,
      })
    }
    return captions
  }
}
