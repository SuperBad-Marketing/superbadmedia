import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execSync } from 'child_process'
import Anthropic from '@anthropic-ai/sdk'

interface SkillFile {
  id: string
  name: string
  category: 'resolve-core' | 'editorial-craft' | 'integration' | 'personal' | 'project-learned'
  source: 'youtube' | 'article' | 'pdf' | 'manual' | 'project-analysis'
  sourceUrl?: string
  content: string
  createdAt: string
  updatedAt: string
  topicCount: number
}

interface ResourceSuggestion {
  id: string
  title: string
  url: string
  sourceType: 'youtube' | 'article' | 'blog'
  description: string
  topic: string
}

interface YouTubeSearchResult {
  id: string
  title: string
  description: string
  channel: string
}

interface EvaluatedResource {
  videoId: string
  relevant: boolean
  title: string
  summary: string
  topics: string[]
}

const SKILLS_DIR = path.join(process.cwd(), 'skills')

export class SkillService {
  private anthropic: Anthropic | null = null

  constructor() {
    fs.mkdirSync(SKILLS_DIR, { recursive: true })
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic()
    }
  }

  getAll(): SkillFile[] {
    try {
      const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.json'))
      return files.map(f => {
        const content = fs.readFileSync(path.join(SKILLS_DIR, f), 'utf-8')
        return JSON.parse(content) as SkillFile
      }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    } catch {
      return []
    }
  }

  createManual(name: string, content: string): SkillFile {
    const skill: SkillFile = {
      id: crypto.randomUUID(),
      name,
      category: 'personal',
      source: 'manual',
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      topicCount: content.split('\n').filter(l => l.trim().startsWith('-')).length || 1,
    }
    this.save(skill)
    return skill
  }

  async learnFromUrl(url: string): Promise<SkillFile> {
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')

    let rawContent: string
    let rawTitle: string

    if (isYouTube) {
      rawContent = this.cleanTranscript(this.getYouTubeTranscript(url))
      rawTitle = this.getYouTubeTitle(url)
    } else {
      rawContent = await this.fetchArticleContent(url)
      rawTitle = url.replace(/^https?:\/\//, '').slice(0, 50)
    }

    let finalContent = rawContent
    let finalTitle = rawTitle
    if (this.anthropic && rawContent.length > 100 && !rawContent.startsWith('[Failed')) {
      const distilled = await this.distillContent(rawContent, rawTitle)
      finalContent = distilled.content
      finalTitle = distilled.title
    }

    const skill: SkillFile = {
      id: crypto.randomUUID(),
      name: finalTitle.slice(0, 50),
      category: 'editorial-craft',
      source: isYouTube ? 'youtube' : 'article',
      sourceUrl: url,
      content: finalContent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      topicCount: finalContent.split('\n').filter(l => l.trim().startsWith('-')).length || 1,
    }

    this.save(skill)
    return skill
  }

  async findResources(topic: string): Promise<ResourceSuggestion[]> {
    const searchResults = this.searchYouTube(topic, 5)
    if (searchResults.length === 0) return []

    const withTranscripts: (YouTubeSearchResult & { transcript: string })[] = []
    for (const result of searchResults) {
      try {
        const raw = this.getYouTubeTranscript(`https://youtube.com/watch?v=${result.id}`)
        const cleaned = this.cleanTranscript(raw)
        if (cleaned.length > 100 && !cleaned.startsWith('[Failed') && !cleaned.startsWith('[Could not') && !cleaned.startsWith('[Transcript extraction')) {
          withTranscripts.push({ ...result, transcript: cleaned })
        }
      } catch {
        // skip videos without usable transcripts
      }
    }

    if (withTranscripts.length === 0) {
      return searchResults.map(r => ({
        id: crypto.randomUUID(),
        title: r.title,
        url: `https://youtube.com/watch?v=${r.id}`,
        sourceType: 'youtube' as const,
        description: r.description?.slice(0, 200) || 'No transcript available for evaluation',
        topic,
      }))
    }

    if (!this.anthropic) {
      return withTranscripts.map(r => ({
        id: crypto.randomUUID(),
        title: r.title,
        url: `https://youtube.com/watch?v=${r.id}`,
        sourceType: 'youtube' as const,
        description: r.transcript.slice(0, 200) + '...',
        topic,
      }))
    }

    try {
      const evaluated = await this.evaluateResources(withTranscripts, topic)
      const relevant = evaluated.filter(e => e.relevant)
      if (relevant.length === 0) {
        return withTranscripts.map(r => ({
          id: crypto.randomUUID(),
          title: r.title,
          url: `https://youtube.com/watch?v=${r.id}`,
          sourceType: 'youtube' as const,
          description: r.transcript.slice(0, 200) + '...',
          topic,
        }))
      }
      return relevant.map(e => ({
        id: crypto.randomUUID(),
        title: e.title,
        url: `https://youtube.com/watch?v=${e.videoId}`,
        sourceType: 'youtube' as const,
        description: e.summary,
        topic,
      }))
    } catch (err: any) {
      console.error('Resource evaluation failed:', err.message)
      return withTranscripts.map(r => ({
        id: crypto.randomUUID(),
        title: r.title,
        url: `https://youtube.com/watch?v=${r.id}`,
        sourceType: 'youtube' as const,
        description: r.transcript.slice(0, 200) + '...',
        topic,
      }))
    }
  }

  delete(id: string): void {
    const filePath = path.join(SKILLS_DIR, `${id}.json`)
    try {
      fs.unlinkSync(filePath)
    } catch {
      // File may not exist
    }
  }

  private save(skill: SkillFile): void {
    const filePath = path.join(SKILLS_DIR, `${skill.id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(skill, null, 2))
  }

  private searchYouTube(query: string, count: number): YouTubeSearchResult[] {
    const sanitized = query.replace(/["`$\\]/g, '')
    try {
      const result = execSync(
        `yt-dlp "ytsearch${count}:${sanitized} video editing" --flat-playlist --dump-json --no-warnings 2>/dev/null`,
        { encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
      )
      return result
        .split('\n')
        .filter(line => line.trim().startsWith('{'))
        .map(line => {
          const item = JSON.parse(line)
          return {
            id: item.id,
            title: item.title || '',
            description: item.description || '',
            channel: item.channel || item.uploader || '',
          }
        })
    } catch {
      return []
    }
  }

  private async evaluateResources(
    resources: (YouTubeSearchResult & { transcript: string })[],
    topic: string
  ): Promise<EvaluatedResource[]> {
    const prompt = resources.map((r, i) =>
      `VIDEO ${i + 1} (id: ${r.id}): "${r.title}" by ${r.channel}\nTranscript excerpt:\n${r.transcript.slice(0, 3000)}`
    ).join('\n\n---\n\n')

    try {
      const response = await this.anthropic!.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Evaluate these YouTube video transcripts for a video editor's knowledge base. The editor wants to learn about: "${topic}".

For each video, assess whether it contains genuinely useful, actionable editing knowledge — not product reviews, vlogs, gear unboxing, or tangential content.

Respond with ONLY a JSON array. For each video:
{"videoId": "the id", "relevant": true/false, "title": "clean descriptive skill title (max 50 chars)", "summary": "2-3 sentence summary of the key techniques this teaches", "topics": ["topic1", "topic2"]}

${prompt}`
        }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      console.error('Claude evaluation returned no parseable JSON:', text.slice(0, 200))
    } catch (err: any) {
      console.error('Claude evaluation API error:', err.message)
    }

    return resources.map(r => ({
      videoId: r.id,
      relevant: true,
      title: r.title.slice(0, 50),
      summary: r.transcript.slice(0, 200),
      topics: [topic],
    }))
  }

  private async distillContent(rawContent: string, originalTitle: string): Promise<{ title: string; content: string }> {
    try {
      const response = await this.anthropic!.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `Distill this into actionable editing knowledge for a video editor's personal knowledge base.

Source: "${originalTitle}"

Raw content (transcript or article):
${rawContent.slice(0, 8000)}

Respond with ONLY a JSON object:
{"title": "Clean descriptive title (max 50 chars)", "content": "Distilled knowledge as a markdown bullet list. Focus on techniques, patterns, and actionable tips. Remove filler, timestamps, and tangential content."}`
        }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch {
      // distillation failed — return raw content
    }

    return { title: originalTitle.slice(0, 50), content: rawContent }
  }

  private async fetchArticleContent(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SuperEdits/1.0)' },
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const html = await response.text()
      return this.htmlToText(html)
    } catch (error: any) {
      return `[Failed to fetch article: ${error.message}]`
    }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000)
  }

  private cleanTranscript(srt: string): string {
    return srt
      .replace(/^\[(?:youtube|download|info|warning|generic)].*/gm, '')
      .replace(/^Downloading .*/gm, '')
      .replace(/^\d+$/gm, '')
      .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{2,}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private getYouTubeTitle(url: string): string {
    try {
      return execSync(
        `yt-dlp --print title "${url}" --no-warnings 2>/dev/null`,
        { encoding: 'utf-8', timeout: 15000 }
      ).trim()
    } catch {
      return `YouTube: ${url.slice(-20)}`
    }
  }

  private getYouTubeTranscript(url: string): string {
    const tmpId = crypto.randomUUID().slice(0, 8)
    const tmpBase = `/tmp/superedits-${tmpId}`

    try {
      execSync(
        `yt-dlp --write-auto-sub --sub-lang en --skip-download --sub-format srt --convert-subs srt -o "${tmpBase}" "${url}" 2>/dev/null`,
        { encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
      )

      for (const ext of ['.en.srt', '.en.vtt']) {
        const filePath = tmpBase + ext
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8')
          try { fs.unlinkSync(filePath) } catch {}
          return content
        }
      }

      return '[No transcript file found. Video may not have captions available.]'
    } catch {
      return '[Failed to extract transcript. Make sure yt-dlp is installed and the video has captions.]'
    }
  }
}
