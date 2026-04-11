---
name: email-nodejs
description: Transactional email for SuperBad HQ using Resend + React Email. Covers setup, branded email templates, Server Action sending pattern, follow-up sequences, and Australian Spam Act compliance. Used for Session 3.4 and any feature that sends email.
---

# Email — Transactional & Sequences for SuperBad HQ

Resend is the recommended email provider — modern API, React template support, excellent deliverability, generous free tier (3,000/mo). Setup via the in-platform wizard at `/settings/integrations/email`.

## Install

```bash
npm install resend react-email @react-email/components
```

## Environment Variables

```bash
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM=andy@superbadmedia.com.au     # must be verified in Resend
EMAIL_FROM_NAME=Andy Robinson — SuperBad
```

---

## 1. Resend Client Singleton

```typescript
// src/lib/email.ts
import { Resend } from 'resend'

const globalForResend = globalThis as unknown as { resend: Resend }

export const resend = globalForResend.resend ?? new Resend(process.env.RESEND_API_KEY!)

if (process.env.NODE_ENV !== 'production') globalForResend.resend = resend
```

---

## 2. Base Email Template

```typescript
// src/emails/base.tsx
import {
  Html, Head, Preview, Body, Container,
  Section, Text, Heading, Hr, Link, Img,
} from '@react-email/components'

interface BaseEmailProps {
  previewText: string
  children: React.ReactNode
}

export function BaseEmail({ previewText, children }: BaseEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: '#1A1A18', fontFamily: 'DM Sans, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
          {/* Logo / Brand Header */}
          <Section style={{ marginBottom: '32px' }}>
            <Heading style={{ color: '#FDF5E6', fontSize: '24px', fontWeight: '900', margin: 0 }}>
              SuperBad
            </Heading>
          </Section>

          {/* Content */}
          <Section style={{
            backgroundColor: '#242422',
            borderRadius: '8px',
            padding: '32px',
            border: '1px solid rgba(253,245,230,0.08)',
          }}>
            {children}
          </Section>

          {/* Footer */}
          <Hr style={{ borderColor: 'rgba(253,245,230,0.12)', margin: '32px 0 16px' }} />
          <Text style={{ color: 'rgba(253,245,230,0.4)', fontSize: '12px', textAlign: 'center' }}>
            SuperBad Marketing — Melbourne, Australia
            <br />
            <Link href="{{unsubscribe_url}}" style={{ color: '#B22848' }}>Unsubscribe</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

---

## 3. Client-Facing Email Templates

```typescript
// src/emails/proposal-sent.tsx
import { BaseEmail } from './base'
import { Heading, Text, Button, Section } from '@react-email/components'

interface Props {
  clientName: string
  proposalUrl: string
  tier: string
  expiresAt: string
}

export function ProposalSentEmail({ clientName, proposalUrl, tier, expiresAt }: Props) {
  return (
    <BaseEmail previewText={`Your SuperBad proposal is ready — ${tier}`}>
      <Heading style={{ color: '#FDF5E6', fontSize: '28px', fontWeight: '900', marginTop: 0 }}>
        Your proposal is ready.
      </Heading>
      <Text style={{ color: 'rgba(253,245,230,0.7)', fontSize: '16px', lineHeight: '1.6' }}>
        Hi {clientName},
      </Text>
      <Text style={{ color: 'rgba(253,245,230,0.7)', fontSize: '16px', lineHeight: '1.6' }}>
        I've put together a proposal for your {tier} engagement. It covers exactly
        what we'll deliver, how we'll work together, and what you can expect in
        the first 90 days.
      </Text>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button
          href={proposalUrl}
          style={{
            backgroundColor: '#B22848',
            color: '#FDF5E6',
            padding: '14px 28px',
            borderRadius: '6px',
            fontWeight: '700',
            fontSize: '16px',
            textDecoration: 'none',
          }}
        >
          View Your Proposal
        </Button>
      </Section>
      <Text style={{ color: 'rgba(253,245,230,0.4)', fontSize: '14px' }}>
        This proposal expires on {expiresAt}. Questions? Reply to this email.
      </Text>
    </BaseEmail>
  )
}
```

---

## 4. Send Function Pattern

```typescript
// src/lib/email/send.ts
import { resend } from '@/lib/email'

interface SendEmailOptions {
  to: string | string[]
  subject: string
  react: React.ReactElement
  replyTo?: string
  tags?: Array<{ name: string; value: string }>
}

export async function sendEmail({ to, subject, react, replyTo, tags }: SendEmailOptions) {
  const { data, error } = await resend.emails.send({
    from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
    to: Array.isArray(to) ? to : [to],
    subject,
    react,
    replyTo: replyTo ?? process.env.EMAIL_FROM,
    tags,
  })

  if (error) {
    console.error('Email send failed:', error)
    throw new Error(`Failed to send email: ${error.message}`)
  }

  return data
}
```

---

## 5. Using in Server Actions

```typescript
// src/app/actions/proposals.ts
'use server'
import { sendEmail } from '@/lib/email/send'
import { ProposalSentEmail } from '@/emails/proposal-sent'

export async function sendProposalEmail(proposalId: string) {
  const proposal = await db.query.proposals.findFirst({
    where: eq(proposals.id, proposalId),
    with: { client: true },
  })

  if (!proposal) throw new Error('Proposal not found')

  await sendEmail({
    to: proposal.client.email,
    subject: `Your SuperBad proposal — ${proposal.tier}`,
    react: ProposalSentEmail({
      clientName: proposal.client.name,
      proposalUrl: `${process.env.NEXT_PUBLIC_APP_URL}/proposals/${proposalId}`,
      tier: proposal.tier,
      expiresAt: format(proposal.expiresAt, 'd MMMM yyyy'),
    }),
    tags: [{ name: 'type', value: 'proposal' }],
  })
}
```

---

## 6. Follow-Up Sequence Engine

Sequences are stored in the database and processed by a scheduled job.

```typescript
// src/db/schema/emailSequences.ts
export const emailSequenceEnrolments = sqliteTable('email_sequence_enrolments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text('client_id').references(() => clients.id).notNull(),
  sequenceName: text('sequence_name').notNull(),   // e.g. 'post_proposal', 'retainer_onboarding'
  currentStep: integer('current_step').default(0),
  status: text('status', { enum: ['active', 'completed', 'paused', 'unsubscribed'] }).default('active'),
  nextSendAt: integer('next_send_at', { mode: 'timestamp' }),
  enrolledAt: integer('enrolled_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})
```

```typescript
// src/lib/email/sequences.ts
// Sequence definitions — steps with delays
export const SEQUENCES = {
  post_proposal: [
    { delay: 0,    subject: 'Your proposal is ready', template: 'proposal-sent' },
    { delay: 3,    subject: 'Any questions about your proposal?', template: 'proposal-followup-1' },
    { delay: 7,    subject: 'Your proposal expires soon', template: 'proposal-expiry-warning' },
  ],
  retainer_onboarding: [
    { delay: 0,    subject: 'Welcome to SuperBad', template: 'welcome' },
    { delay: 1,    subject: 'What to expect in your first week', template: 'onboarding-week-1' },
    { delay: 7,    subject: 'Your first monthly review is coming up', template: 'first-review-reminder' },
    { delay: 30,   subject: 'One month in — here\'s what we\'ve built', template: 'month-one-recap' },
  ],
} as const

// Process due emails (called by a scheduled API route or cron)
export async function processSequenceQueue() {
  const due = await db
    .select()
    .from(emailSequenceEnrolments)
    .where(and(
      eq(emailSequenceEnrolments.status, 'active'),
      lte(emailSequenceEnrolments.nextSendAt, new Date())
    ))

  for (const enrolment of due) {
    const sequence = SEQUENCES[enrolment.sequenceName as keyof typeof SEQUENCES]
    const step = sequence[enrolment.currentStep]
    if (!step) continue

    // Send the email
    const client = await db.query.clients.findFirst({ where: eq(clients.id, enrolment.clientId) })
    if (client) {
      await sendSequenceEmail(step.template, client)
    }

    // Advance to next step or complete
    const nextStep = enrolment.currentStep + 1
    const nextSequenceStep = sequence[nextStep]

    await db.update(emailSequenceEnrolments).set({
      currentStep: nextStep,
      status: nextSequenceStep ? 'active' : 'completed',
      nextSendAt: nextSequenceStep
        ? addDays(new Date(), nextSequenceStep.delay)
        : null,
    }).where(eq(emailSequenceEnrolments.id, enrolment.id))
  }
}
```

---

## 7. Australian Spam Act Compliance

Every marketing/sequence email must include:
- **Sender identification** — "SuperBad Marketing" + andy@superbadmedia.com.au
- **Unsubscribe mechanism** — `{{unsubscribe_url}}` or a direct link to `/unsubscribe?token=xxx`
- **Physical address** — Melbourne, Australia in the footer
- **Never send to purchased lists** — only to contacts who have provided consent

Transactional emails (invoice, proposal, booking confirmation) are exempt from unsubscribe requirements but must still identify the sender.

---

## 8. Preview Emails in Dev

```bash
# Start the React Email preview server
npx react-email dev --dir src/emails --port 3100
# Open http://localhost:3100 to preview all templates
```

---

## 9. Critical Rules

- **Verify the sending domain** in Resend before going live — emails sent from unverified domains have poor deliverability
- **Always include unsubscribe link** in marketing/sequence emails — Australian Spam Act requires it
- **Test with real addresses** before bulk sends — Resend has a `test` mode but real inbox testing catches rendering issues
- **`react` prop not `html`** — always pass the React component to Resend, not rendered HTML
- **Rate limit follow-up sequences** — Resend free tier: 100/day; paid: 50,000+/mo
