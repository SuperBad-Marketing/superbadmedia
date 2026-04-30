import { Router } from 'express'

const router = Router()

router.post('/generate', (req, res) => {
  const config = req.body

  const variations: any[] = []
  let id = 0

  const formats = config.formats || ['16:9']
  const lengths = config.lengths || [30]
  const hookCount = config.hookCount || 1
  const ctas = config.ctas?.length ? config.ctas : ['']
  const pacings: string[] = ['normal']
  if (config.includeFasterPacing) pacings.push('fast')
  if (config.includeSlowerPacing) pacings.push('slow')

  for (const format of formats) {
    for (const length of lengths) {
      for (let hook = 1; hook <= hookCount; hook++) {
        for (const cta of ctas) {
          for (const pacing of pacings) {
            variations.push({
              id: String(++id),
              type: 'video',
              format,
              length,
              hookVariant: hook,
              cta: cta || undefined,
              pacing,
              status: 'ready',
            })
          }
        }
      }
    }
  }

  if (config.includeStatics) {
    const staticTypes = config.staticTypes || ['single']
    for (const format of formats) {
      for (const staticType of staticTypes) {
        variations.push({
          id: String(++id),
          type: 'static',
          format,
          staticType,
          headline: config.headline,
          subheadline: config.subheadline,
          status: 'ready',
        })
      }
    }
  }

  res.json({ variations, total: variations.length })
})

export { router as adsRouter }
