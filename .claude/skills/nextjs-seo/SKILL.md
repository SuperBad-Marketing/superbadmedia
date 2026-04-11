---
name: nextjs-seo
description: Next.js App Router SEO — metadata API, Open Graph, Twitter cards, JSON-LD structured data, dynamic sitemaps, robots.txt, and canonical URLs. Used for Session 4.1 (SuperBad marketing site) and Session 5.3 (SEO dashboard).
---

# Next.js SEO — SuperBad Marketing Site

Session 4.1 rebuilds superbadmedia.com.au in Next.js. Every public page needs proper metadata, Open Graph tags, structured data, and a sitemap. This is all handled natively in Next.js App Router — no external SEO library needed.

---

## 1. Root Layout Metadata

```typescript
// src/app/(public)/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://superbadmedia.com.au'),
  title: {
    default: 'SuperBad Marketing — Performance Marketing for Melbourne Businesses',
    template: '%s | SuperBad Marketing',
  },
  description: 'Performance marketing and creative media for medical aesthetics, financial planning, and allied health businesses in Melbourne.',
  keywords: ['performance marketing', 'Melbourne', 'medical aesthetics marketing', 'financial services marketing'],
  authors: [{ name: 'Andy Robinson', url: 'https://superbadmedia.com.au' }],
  creator: 'SuperBad Marketing',
  openGraph: {
    type: 'website',
    locale: 'en_AU',
    url: 'https://superbadmedia.com.au',
    siteName: 'SuperBad Marketing',
    images: [
      {
        url: '/og-default.jpg',    // 1200×630px
        width: 1200,
        height: 630,
        alt: 'SuperBad Marketing',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@superbadmktg',
    creator: '@andyrobinson',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://superbadmedia.com.au',
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
}
```

---

## 2. Page-Level Metadata (Static)

```typescript
// src/app/(public)/about/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About',   // becomes "About | SuperBad Marketing" via template
  description: 'Andy Robinson and the story behind SuperBad Marketing — performance marketing built for growth, not optics.',
  alternates: {
    canonical: 'https://superbadmedia.com.au/about',
  },
  openGraph: {
    title: 'About SuperBad Marketing',
    description: 'Performance marketing built for growth, not optics.',
    url: 'https://superbadmedia.com.au/about',
    images: [{ url: '/og-about.jpg', width: 1200, height: 630 }],
  },
}
```

---

## 3. Dynamic Metadata (for blog posts, case studies)

```typescript
// src/app/(public)/blog/[slug]/page.tsx
import type { Metadata } from 'next'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPostBySlug(params.slug)

  if (!post) {
    return { title: 'Post Not Found' }
  }

  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `https://superbadmedia.com.au/blog/${post.slug}`,
    },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url: `https://superbadmedia.com.au/blog/${post.slug}`,
      publishedTime: post.publishedAt.toISOString(),
      authors: ['Andy Robinson'],
      images: [
        {
          url: post.coverImage ?? '/og-default.jpg',
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
  }
}
```

---

## 4. JSON-LD Structured Data

Add as a `<script>` tag in the page component (not metadata). Helps Google understand business type.

```typescript
// src/app/(public)/page.tsx — Homepage
export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'SuperBad Marketing',
    description: 'Performance marketing and creative media for Melbourne businesses.',
    url: 'https://superbadmedia.com.au',
    email: 'andy@superbadmedia.com.au',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Melbourne',
      addressRegion: 'VIC',
      addressCountry: 'AU',
    },
    areaServed: { '@type': 'City', name: 'Melbourne' },
    serviceType: ['Performance Marketing', 'Digital Advertising', 'Content Production'],
    priceRange: '$$$$',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* page content */}
    </>
  )
}
```

```typescript
// For blog posts — Article schema
const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: post.title,
  description: post.excerpt,
  author: { '@type': 'Person', name: 'Andy Robinson' },
  publisher: {
    '@type': 'Organization',
    name: 'SuperBad Marketing',
    logo: { '@type': 'ImageObject', url: 'https://superbadmedia.com.au/logo.png' },
  },
  datePublished: post.publishedAt.toISOString(),
  dateModified: post.updatedAt.toISOString(),
}
```

---

## 5. Dynamic Sitemap

```typescript
// src/app/(public)/sitemap.ts
import { MetadataRoute } from 'next'
import { db } from '@/db'
import { posts } from '@/db/schema'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://superbadmedia.com.au'

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/services`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/contact`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.7 },
  ]

  // Dynamic blog posts
  const allPosts = await db.select({ slug: posts.slug, updatedAt: posts.updatedAt }).from(posts)
  const postPages: MetadataRoute.Sitemap = allPosts.map(post => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  return [...staticPages, ...postPages]
}
```

---

## 6. robots.txt

```typescript
// src/app/(public)/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/settings/'],
      },
    ],
    sitemap: 'https://superbadmedia.com.au/sitemap.xml',
  }
}
```

---

## 7. Open Graph Image Generation (Dynamic)

```typescript
// src/app/(public)/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage({ params }: { params: { slug: string } }) {
  const post = await getPostBySlug(params.slug)

  return new ImageResponse(
    (
      <div style={{
        background: '#1A1A18',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
      }}>
        <div style={{ color: '#B22848', fontSize: 18, fontWeight: 700, marginBottom: 24 }}>
          SUPERBAD MARKETING
        </div>
        <div style={{ color: '#FDF5E6', fontSize: 56, fontWeight: 900, lineHeight: 1.1 }}>
          {post?.title}
        </div>
      </div>
    ),
    { ...size }
  )
}
```

---

## 8. Critical Rules

- **`metadataBase` is required** in root layout — without it, relative OG image URLs break
- **Every public page needs unique title + description** — never duplicate across pages
- **Canonical URLs on all pages** — prevents duplicate content penalties from Cloudflare CDN caching
- **JSON-LD in the page component**, not in metadata — metadata API doesn't support arbitrary script injection
- **`changeFrequency` is a hint**, not a guarantee — Google uses it as guidance only
- **Platform pages excluded from robots.txt** — `/dashboard/`, `/api/`, `/settings/` must be disallowed
- **OG images must be 1200×630px** — other sizes technically work but 1200×630 is the universal safe zone
