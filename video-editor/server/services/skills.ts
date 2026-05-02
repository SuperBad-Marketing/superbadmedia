import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execSync } from 'child_process'
import Anthropic from '@anthropic-ai/sdk'
import { dataPath } from './dataRoot.js'

export interface SkillQualityScore {
  quantifiedParams: number
  conditionalLogic: number
  structuredPatterns: number
  decisionBoundaries: number
  total: number
  passing: boolean
  gaps: string[]
}

export interface SkillFile {
  id: string
  name: string
  category: 'resolve-core' | 'editorial-craft' | 'integration' | 'personal' | 'project-learned'
  source: 'youtube' | 'article' | 'pdf' | 'manual' | 'project-analysis'
  sourceUrl?: string
  content: string
  createdAt: string
  updatedAt: string
  topicCount: number
  qualityScore?: SkillQualityScore
  llmReady?: boolean
}

const QUALITY_THRESHOLD = 12

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

const SKILLS_DIR = dataPath('skills')

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

    const score = this.evaluateQuality(finalContent)

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
      qualityScore: score,
      llmReady: score.passing,
    }

    this.save(skill)

    if (!score.passing && this.anthropic) {
      return this.upgradeSkill(skill)
    }

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

  getEditorialSkills(): SkillFile[] {
    return this.getAll().filter(s => s.category === 'editorial-craft')
  }

  getLlmReadySkills(): SkillFile[] {
    return this.getAll().filter(s => s.category === 'editorial-craft' && s.llmReady !== false)
  }

  getSkillSummaries(): { id: string; name: string; category: string; llmReady: boolean }[] {
    return this.getAll()
      .filter(s => s.category === 'editorial-craft')
      .map(s => ({ id: s.id, name: s.name, category: s.category, llmReady: s.llmReady ?? false }))
  }

  autoSelectSkills(footageProfile: {
    hasPersonContent: boolean
    hasActionContent: boolean
    hasStaticContent: boolean
    hasDroneFootage: boolean
    hasInteractions: boolean
    dominantActivities: string[]
    dominantSceneTypes: string[]
  }, pacing: string, intensity: number): string[] {
    const skills = this.getLlmReadySkills()
    const selected: string[] = []

    const nameMatches = (skill: SkillFile, ...keywords: string[]) =>
      keywords.some(k => skill.name.toLowerCase().includes(k))

    for (const skill of skills) {
      const name = skill.name.toLowerCase()

      if (nameMatches(skill, 'montage', 'shot sequencing', 'clip selection', 'energy curve')) {
        selected.push(skill.id)
        continue
      }

      if (nameMatches(skill, 'pacing', 'editorial pacing') && !nameMatches(skill, 'genre')) {
        selected.push(skill.id)
        continue
      }

      if (nameMatches(skill, 'genre pacing') && (footageProfile.hasActionContent || pacing === 'fast' || intensity > 60)) {
        selected.push(skill.id)
        continue
      }

      if (nameMatches(skill, 'sound design', 'sfx')) {
        selected.push(skill.id)
        continue
      }

      if (nameMatches(skill, 'music editorial')) {
        selected.push(skill.id)
        continue
      }

      if (nameMatches(skill, 'speed ramp', 'slow motion') && (pacing === 'fast' || intensity > 50)) {
        selected.push(skill.id)
        continue
      }

      if (nameMatches(skill, 'interview', 'multicam') && (
        footageProfile.dominantSceneTypes.includes('interview') ||
        footageProfile.hasInteractions
      )) {
        selected.push(skill.id)
        continue
      }

      if (nameMatches(skill, 'social format') && ['instagram-reel', 'youtube-short', 'tiktok'].some(p => pacing === p)) {
        selected.push(skill.id)
        continue
      }

      if (nameMatches(skill, 'colour', 'color', 'grading')) {
        continue
      }

      if (nameMatches(skill, 'transition')) {
        selected.push(skill.id)
        continue
      }
    }

    return selected
  }

  getSkillsByIds(ids: string[]): SkillFile[] {
    const all = this.getLlmReadySkills()
    return ids.map(id => all.find(s => s.id === id)).filter(Boolean) as SkillFile[]
  }

  evaluateQuality(content: string): SkillQualityScore {
    const lines = content.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'))

    let quantifiedParams = 0
    let conditionalLogic = 0
    let structuredPatterns = 0
    let decisionBoundaries = 0

    const numberPattern = /\b\d+(\.\d+)?\s*(s|ms|seconds|fps|bpm|db|%|px|cuts?|shots?|beats?)\b/i
    const rangePattern = /\b\d+(\.\d+)?\s*[-–—to]+\s*\d+(\.\d+)?\s*(s|ms|seconds|fps|bpm|db|%)\b/i
    const conditionalPattern = /\b(if|when|for|during|after|before|unless|while)\b.*\b(use|cut|hold|reduce|increase|apply|switch|set|drop|add|remove|avoid|prefer)\b/i
    const patternNamePattern = /\*\*[^*]+\*\*\s*[:—–-]/
    const sequencePattern = /→|->|then|followed by|into|before.*after/i
    const decisionPattern = /\b(vs\.?|versus|instead of|rather than|not\b.*\buse\b|never.*when|always.*when|works? best (for|with|when)|use for|avoid for|good for|bad for)\b/i
    const thresholdPattern = /\b(minimum|maximum|at least|no more than|threshold|limit|cap at|floor|ceiling)\b/i

    for (const line of lines) {
      if (numberPattern.test(line) || rangePattern.test(line)) quantifiedParams++
      if (conditionalPattern.test(line)) conditionalLogic++
      if (patternNamePattern.test(line) || sequencePattern.test(line)) structuredPatterns++
      if (decisionPattern.test(line) || thresholdPattern.test(line)) decisionBoundaries++
    }

    const headings = content.match(/^##\s+.+/gm) || []
    structuredPatterns += Math.min(headings.length, 5)

    const total = quantifiedParams + conditionalLogic + structuredPatterns + decisionBoundaries

    const gaps: string[] = []
    if (quantifiedParams < 3) gaps.push('needs more specific numbers, durations, and thresholds')
    if (conditionalLogic < 3) gaps.push('needs more if/when conditional rules (e.g. "when pacing is fast, cut at 0.2-0.4s")')
    if (structuredPatterns < 3) gaps.push('needs more named patterns with step-by-step sequences')
    if (decisionBoundaries < 2) gaps.push('needs more decision boundaries (when to use X vs Y)')

    return {
      quantifiedParams,
      conditionalLogic,
      structuredPatterns,
      decisionBoundaries,
      total,
      passing: total >= QUALITY_THRESHOLD,
      gaps,
    }
  }

  async upgradeSkill(skill: SkillFile): Promise<SkillFile> {
    if (!this.anthropic) return skill

    const score = this.evaluateQuality(skill.content)
    if (score.passing) {
      skill.qualityScore = score
      skill.llmReady = true
      this.save(skill)
      return skill
    }

    const reDistilled = await this.reDistillForLlm(skill.content, skill.name, score.gaps)
    if (reDistilled) {
      const reScore = this.evaluateQuality(reDistilled)
      if (reScore.passing) {
        skill.content = reDistilled
        skill.qualityScore = reScore
        skill.llmReady = true
        skill.updatedAt = new Date().toISOString()
        skill.topicCount = reDistilled.split('\n').filter(l => l.trim().startsWith('-')).length || 1
        this.save(skill)
        return skill
      }
    }

    const supplemented = await this.gapSearch(skill.name, score.gaps, skill.content)
    if (supplemented) {
      const merged = skill.content + '\n\n' + supplemented
      const mergeScore = this.evaluateQuality(merged)
      skill.content = merged
      skill.qualityScore = mergeScore
      skill.llmReady = mergeScore.passing
      skill.updatedAt = new Date().toISOString()
      skill.topicCount = merged.split('\n').filter(l => l.trim().startsWith('-')).length || 1
      this.save(skill)
    } else {
      skill.qualityScore = score
      skill.llmReady = false
      this.save(skill)
    }

    return skill
  }

  async upgradeAll(): Promise<{ upgraded: number; total: number; results: { name: string; before: number; after: number; passing: boolean }[] }> {
    const skills = this.getAll().filter(s => s.category === 'editorial-craft')
    const results: { name: string; before: number; after: number; passing: boolean }[] = []
    let upgraded = 0

    for (const skill of skills) {
      const before = this.evaluateQuality(skill.content).total
      const updated = await this.upgradeSkill(skill)
      const after = updated.qualityScore?.total ?? before
      if (after > before) upgraded++
      results.push({ name: skill.name, before, after, passing: updated.llmReady ?? false })
    }

    return { upgraded, total: skills.length, results }
  }

  private async reDistillForLlm(content: string, title: string, gaps: string[]): Promise<string | null> {
    try {
      const response = await this.anthropic!.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `You are converting video editing knowledge into a format that another LLM can use to make precise editing decisions (choosing clips, setting cut durations, placing SFX, picking transitions).

SOURCE SKILL: "${title}"

CURRENT CONTENT:
${content.slice(0, 6000)}

THIS SKILL IS MISSING:
${gaps.map(g => `- ${g}`).join('\n')}

REWRITE the skill as prescriptive, machine-actionable rules:
1. Every rule that involves timing MUST include specific numbers (e.g. "0.2-0.4s" not "fast")
2. Every technique MUST have conditional triggers (e.g. "WHEN pacing is fast AND movement is high, THEN cut duration = 0.1-0.3s")
3. Every pattern MUST be a named sequence with explicit steps (e.g. "Accelerating cascade: 2.0s → 1.5s → 0.8s → 0.4s → 0.2s")
4. Every choice MUST have decision boundaries (e.g. "Use dissolve for pace changes >2x. Use hard cut for energy maintenance. Use impact for drops >3x energy shift.")

Keep the original knowledge but restructure it so an LLM can follow the rules mechanically. Use markdown with ## headings and bullet points.

Respond with ONLY the rewritten content (no JSON wrapper, no explanation).`
        }],
      })

      const text = response.content.find(b => b.type === 'text')?.text
      if (text && text.length > 200) return text
    } catch (err: any) {
      console.error('Re-distillation failed:', err.message)
    }
    return null
  }

  private async gapSearch(skillName: string, gaps: string[], existingContent: string): Promise<string | null> {
    if (!this.anthropic) return null

    const queryResponse = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `A video editing skill file called "${skillName}" is missing these qualities:
${gaps.map(g => `- ${g}`).join('\n')}

Generate 2-3 specific YouTube search queries that would find tutorials teaching the MISSING knowledge. Focus on practical technique tutorials, not reviews or vlogs.

Respond with ONLY a JSON array of strings, e.g. ["query one", "query two"]`
      }],
    })

    const queryText = queryResponse.content.find(b => b.type === 'text')?.text ?? '[]'
    let queries: string[]
    try {
      queries = JSON.parse(queryText.match(/\[[\s\S]*\]/)?.[0] || '[]')
    } catch {
      return null
    }

    const allTranscripts: string[] = []

    for (const query of queries.slice(0, 3)) {
      const results = this.searchYouTube(query, 2)
      for (const result of results) {
        try {
          const raw = this.getYouTubeTranscript(`https://youtube.com/watch?v=${result.id}`)
          const cleaned = this.cleanTranscript(raw)
          if (cleaned.length > 200 && !cleaned.startsWith('[')) {
            allTranscripts.push(`Source: "${result.title}" by ${result.channel}\n${cleaned.slice(0, 3000)}`)
          }
        } catch {
          // skip
        }
      }
    }

    if (allTranscripts.length === 0) return null

    try {
      const supplementResponse = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `Extract ONLY the knowledge that fills these specific gaps for a video editing skill called "${skillName}":
${gaps.map(g => `- ${g}`).join('\n')}

EXISTING SKILL CONTENT (do NOT repeat this):
${existingContent.slice(0, 2000)}

NEW SOURCE MATERIAL:
${allTranscripts.join('\n\n---\n\n')}

Rules:
1. Only extract knowledge that addresses the listed gaps
2. Convert everything to prescriptive rules with specific numbers and conditions
3. Use markdown ## headings and bullet points
4. Do NOT repeat anything already in the existing content

Respond with ONLY the supplementary content (no JSON, no explanation). If the source material doesn't contain useful gap-filling knowledge, respond with exactly "NO_USEFUL_CONTENT".`
        }],
      })

      const text = supplementResponse.content.find(b => b.type === 'text')?.text
      if (text && text.length > 100 && !text.includes('NO_USEFUL_CONTENT')) return text
    } catch (err: any) {
      console.error('Gap search supplement failed:', err.message)
    }

    return null
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
