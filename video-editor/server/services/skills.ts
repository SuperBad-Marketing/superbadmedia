import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execSync } from 'child_process'

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

const SKILLS_DIR = path.join(process.cwd(), 'skills')

export class SkillService {
  constructor() {
    fs.mkdirSync(SKILLS_DIR, { recursive: true })
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

    if (isYouTube) {
      rawContent = this.getYouTubeTranscript(url)
    } else {
      rawContent = `Content from: ${url}\n\n[URL content would be fetched and processed here. The Anthropic API would then distill this into actionable editing patterns.]`
    }

    const skill: SkillFile = {
      id: crypto.randomUUID(),
      name: isYouTube ? `YouTube: ${url.slice(-20)}` : `Article: ${url.slice(0, 40)}`,
      category: 'editorial-craft',
      source: isYouTube ? 'youtube' : 'article',
      sourceUrl: url,
      content: rawContent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      topicCount: rawContent.split('\n').filter(l => l.trim().startsWith('-')).length || 1,
    }

    this.save(skill)
    return skill
  }

  async findResources(topic: string): Promise<ResourceSuggestion[]> {
    const suggestions: Record<string, ResourceSuggestion[]> = {
      'Resolve Scripting API': [
        { id: crypto.randomUUID(), title: 'DaVinci Resolve Scripting API Complete Guide', url: 'https://youtube.com/watch?v=example1', sourceType: 'youtube', description: 'Full walkthrough of the Resolve scripting API with Python examples', topic },
        { id: crypto.randomUUID(), title: 'Automating DaVinci Resolve with Python', url: 'https://youtube.com/watch?v=example2', sourceType: 'youtube', description: 'Practical automation scripts for batch processing and project setup', topic },
        { id: crypto.randomUUID(), title: 'Resolve Scripting API Documentation', url: 'https://example.com/resolve-docs', sourceType: 'article', description: 'Official Blackmagic documentation for the scripting API', topic },
      ],
      'Editorial Pacing': [
        { id: crypto.randomUUID(), title: 'How to Edit Like a Pro — Pacing & Rhythm', url: 'https://youtube.com/watch?v=example3', sourceType: 'youtube', description: 'This Guy Edits breaks down editorial pacing theory', topic },
        { id: crypto.randomUUID(), title: 'The Art of the Cut — When and Why We Edit', url: 'https://youtube.com/watch?v=example4', sourceType: 'youtube', description: 'Every Frame a Painting on editing rhythm and motivation', topic },
      ],
      'Colour Grading': [
        { id: crypto.randomUUID(), title: 'Color Grading Masterclass in DaVinci Resolve', url: 'https://youtube.com/watch?v=example5', sourceType: 'youtube', description: 'Cullen Kelly deep dive on node trees and look development', topic },
        { id: crypto.randomUUID(), title: 'S-Log3 to Rec.709 — The Right Way', url: 'https://youtube.com/watch?v=example6', sourceType: 'youtube', description: 'Proper Sony LOG workflow in Resolve with skin tone protection', topic },
      ],
      'Sound Design': [
        { id: crypto.randomUUID(), title: 'Sound Design for Video Editors', url: 'https://youtube.com/watch?v=example7', sourceType: 'youtube', description: 'SFX layering, foley thinking, and mixing for YouTube content', topic },
        { id: crypto.randomUUID(), title: 'Building Cinematic Transitions with Sound', url: 'https://youtube.com/watch?v=example8', sourceType: 'youtube', description: 'How to combine visual transitions with layered SFX for Hollywood feel', topic },
      ],
      'Transitions': [
        { id: crypto.randomUUID(), title: 'Pro Transitions That Actually Look Good', url: 'https://youtube.com/watch?v=example9', sourceType: 'youtube', description: 'Beyond wipes and fades — cinematic transitions with matched audio', topic },
      ],
    }

    const key = Object.keys(suggestions).find(k => topic.toLowerCase().includes(k.toLowerCase()))
    if (key) return suggestions[key]

    return [
      { id: crypto.randomUUID(), title: `${topic} — Tutorial`, url: `https://youtube.com/results?search_query=${encodeURIComponent(topic + ' DaVinci Resolve tutorial')}`, sourceType: 'youtube', description: `Search results for ${topic} tutorials`, topic },
    ]
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

  private getYouTubeTranscript(url: string): string {
    try {
      const result = execSync(
        `yt-dlp --write-auto-sub --sub-lang en --skip-download --print-to-file "%(subtitles.en.-1.ext)s" /dev/null -o - "${url}" 2>/dev/null || yt-dlp --write-auto-sub --sub-lang en --skip-download --sub-format best --convert-subs srt -o "/tmp/superedits-%(id)s" "${url}" 2>/dev/null && cat /tmp/superedits-*.en.* 2>/dev/null`,
        { encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
      )
      return result || '[Transcript extraction completed but no content was returned. Try a different video.]'
    } catch {
      try {
        const result = execSync(
          `yt-dlp --write-auto-sub --sub-lang en --skip-download --sub-format srt --convert-subs srt -o "/tmp/superedits-sub" "${url}" 2>&1 && cat /tmp/superedits-sub.en.srt 2>/dev/null`,
          { encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
        )
        return result || '[Could not extract transcript. Video may not have captions available.]'
      } catch {
        return '[Failed to extract transcript. Make sure yt-dlp is installed and the video has captions.]'
      }
    }
  }
}
