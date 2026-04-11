---
name: pdf-generation-nextjs
description: Programmatic PDF generation in Next.js for SuperBad HQ — covers Puppeteer (already in stack) for HTML-to-PDF, @react-pdf/renderer for code-driven reports, API route streaming pattern, branded report templates, and download endpoint. Used for Session 6.2 (client reports) and Session 5.5 (pitch decks).
---

# PDF Generation — Client Reports & Proposals

SuperBad HQ already has Puppeteer in the stack (used for HTML→PNG). Session 6.2 and 5.5 need branded PDFs: monthly client reports, proposals, case studies. Two approaches — use the right one for each case.

---

## Approach A — Puppeteer (HTML→PDF)

**Best for:** Reports with complex layouts, charts, real data from the DB. Use when the design is primarily HTML/CSS.

Puppeteer is already installed. No new package needed.

```typescript
// src/lib/pdf/puppeteer.ts
import puppeteer from 'puppeteer'

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()

  await page.setContent(html, { waitUntil: 'networkidle0' })

  // Inject fonts — important for SuperBad brand typography
  await page.addStyleTag({
    content: `
      @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=DM+Sans:wght@400;500;700&display=swap');
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    `
  })

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
  })

  await browser.close()
  return Buffer.from(pdf)
}
```

**Client Report HTML Template:**

```typescript
// src/lib/pdf/templates/client-report.ts
interface ReportData {
  clientName: string
  month: string
  metrics: { label: string; value: string; change: string; positive: boolean }[]
  highlights: string[]
  nextMonthFocus: string[]
}

export function clientReportHtml(data: ReportData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'DM Sans', sans-serif;
      background: #1A1A18;
      color: #FDF5E6;
      margin: 0;
      padding: 0;
    }
    .header {
      background: #242422;
      padding: 40px;
      border-bottom: 2px solid #B22848;
    }
    .brand {
      font-family: 'Black Han Sans', sans-serif;
      font-size: 28px;
      color: #FDF5E6;
      margin: 0;
    }
    .report-title {
      font-size: 36px;
      font-weight: 900;
      margin: 8px 0 4px;
    }
    .subtitle { color: rgba(253,245,230,0.5); font-size: 16px; }
    .content { padding: 40px; }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 40px;
    }
    .metric-card {
      background: #242422;
      border: 1px solid rgba(253,245,230,0.08);
      border-radius: 8px;
      padding: 20px;
    }
    .metric-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(253,245,230,0.5); }
    .metric-value { font-size: 32px; font-weight: 900; margin: 8px 0; }
    .metric-change { font-size: 14px; }
    .positive { color: #4CAF50; }
    .negative { color: #B22848; }
    .section-title {
      font-family: 'Black Han Sans', sans-serif;
      font-size: 18px;
      color: #B22848;
      margin: 32px 0 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; color: rgba(253,245,230,0.8); line-height: 1.6; }
    .footer {
      padding: 24px 40px;
      border-top: 1px solid rgba(253,245,230,0.08);
      color: rgba(253,245,230,0.3);
      font-size: 12px;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <p class="brand">SUPERBAD</p>
    <h1 class="report-title">${data.clientName}</h1>
    <p class="subtitle">Monthly Performance Report — ${data.month}</p>
  </div>

  <div class="content">
    <div class="metrics-grid">
      ${data.metrics.map(m => `
        <div class="metric-card">
          <div class="metric-label">${m.label}</div>
          <div class="metric-value">${m.value}</div>
          <div class="metric-change ${m.positive ? 'positive' : 'negative'}">${m.change}</div>
        </div>
      `).join('')}
    </div>

    <div class="section-title">Highlights This Month</div>
    <ul>${data.highlights.map(h => `<li>${h}</li>`).join('')}</ul>

    <div class="section-title">Next Month Focus</div>
    <ul>${data.nextMonthFocus.map(f => `<li>${f}</li>`).join('')}</ul>
  </div>

  <div class="footer">
    <span>SuperBad Marketing — Melbourne</span>
    <span>andy@superbadmedia.com.au</span>
  </div>
</body>
</html>
  `
}
```

---

## Approach B — @react-pdf/renderer

**Best for:** Structured documents (proposals, contracts) where the layout is consistent and predictable. Runs server-side without a browser.

```bash
npm install @react-pdf/renderer
```

```typescript
// src/lib/pdf/react-pdf.ts
import { renderToBuffer } from '@react-pdf/renderer'
import { ProposalDocument } from '@/components/pdf/ProposalDocument'

export async function generateProposalPdf(proposalId: string): Promise<Buffer> {
  const proposal = await getProposalData(proposalId)
  const buffer = await renderToBuffer(<ProposalDocument proposal={proposal} />)
  return buffer
}
```

```typescript
// src/components/pdf/ProposalDocument.tsx
import {
  Document, Page, Text, View, StyleSheet, Font
} from '@react-pdf/renderer'

Font.register({
  family: 'DM Sans',
  src: 'https://fonts.gstatic.com/s/dmsans/v14/rP2Hp2ywxg089UriCZOIHQ.ttf',
})

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#1A1A18',
    padding: 40,
    fontFamily: 'DM Sans',
  },
  heading: {
    fontSize: 32,
    color: '#FDF5E6',
    fontWeight: 700,
    marginBottom: 8,
  },
  accent: { color: '#B22848' },
  body: {
    fontSize: 11,
    color: 'rgba(253,245,230,0.7)',
    lineHeight: 1.6,
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 10,
    color: '#B22848',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
})

export function ProposalDocument({ proposal }: { proposal: ProposalData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.heading}>{proposal.clientName}</Text>
          <Text style={[styles.body, styles.accent]}>{proposal.tier} Proposal</Text>
        </View>
        {/* ... sections */}
      </Page>
    </Document>
  )
}
```

---

## API Route — PDF Download Endpoint

```typescript
// src/app/api/reports/[clientId]/[month]/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { generatePdfFromHtml } from '@/lib/pdf/puppeteer'
import { clientReportHtml } from '@/lib/pdf/templates/client-report'
import { getReportData } from '@/lib/reports'

export async function GET(
  request: Request,
  { params }: { params: { clientId: string; month: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await getReportData(params.clientId, params.month)
  const html = clientReportHtml(data)
  const pdfBuffer = await generatePdfFromHtml(html)

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="superbad-report-${params.month}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
    },
  })
}
```

**Trigger download from client component:**
```typescript
async function downloadReport(clientId: string, month: string) {
  const res = await fetch(`/api/reports/${clientId}/${month}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `superbad-report-${month}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## Critical Rules

- **Use Puppeteer for data-rich reports** — charts, tables, real metrics; use `@react-pdf/renderer` for fixed-layout docs
- **`--no-sandbox`** is required in Nixpacks/DigitalOcean — the default Puppeteer sandbox doesn't work in Docker
- **Print colour adjust** CSS is mandatory — without it, background colours get stripped in PDF output
- **Font loading** — either embed Google Fonts via `@import` (Puppeteer) or register via `Font.register()` (react-pdf). Never assume system fonts
- **Buffer not stream** for Coolify — streaming works locally but Buffer is more reliable in containerised environments
- **Timeout** — complex reports with charts can take 3–8 seconds. Set `waitUntil: 'networkidle0'` and add a reasonable API route timeout
