# Onboarding Prompts — OS-1

## onboarding-welcome-email (Opus)

Generate a welcome email for a new client/subscriber of SuperBad Marketing.

**Inputs:**
- SuperBad's own Brand DNA profile (system context)
- Client Context Engine summary or deal notes (if available)
- Audience: "retainer" or "saas"
- Product name (SaaS only)
- Customer name
- Portal link with token

**Retainer variant:**
- Personalised opening referencing something specific from the deal context
- Time expectation for Brand DNA (~30 min)
- Brief preview of what comes after

**SaaS variant:**
- Graceful degradation: rich if outreach-sourced, basic if cold signup
- Product name in subject and body
- Time expectation for Brand DNA + product setup

**Voice:** SuperBad voice — dry, observational, human. Admin-roommate register. Not a pitch, not a celebration. The first programmatic sentence a new client reads from SuperBad.

**Output:** JSON `{ subject: string, body_html: string }`

## onboarding-welcome-summary (Opus)

Generate the "what we already know about you" paragraph for the retainer welcome screen.

**Inputs:**
- SuperBad's own Brand DNA profile (system context)
- Deal notes, quote context, outreach research (if any)
- Client name, company name

**Output:** A warm, observant, specific paragraph (3-5 sentences). Not a data dump. Makes the client feel known before the assessment starts. Reads the client doc source hierarchy: client-supplied docs > direct answers > owned web > scrapes > LLM inference.

**Voice:** Admin-roommate register. Human, specific, never generic.
