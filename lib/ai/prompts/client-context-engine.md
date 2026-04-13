---
spec: docs/specs/client-context-engine.md
status: stub
populated-by: Client Context Engine content mini-session (can fold into another)
---

# Client Context Engine prompts

## `client-context-summarise`

**Tier:** Haiku. **Intent:** background task on material events; summarise contact context from recent messages + activity log + action items + deal state + invoice status + Brand DNA. **Output:** flat factual narrative, 2–4 sentences. ~4k token cap. **Current inline location:** spec §13.1.

## `client-context-extract-action-items`

**Tier:** Haiku. **Intent:** background task per new message (inbound or outbound); extract action items from message body. **Output:** array of `{description, owner, due_date}`. **Ownership rule:** first-person inbound = them; first-person outbound = you. ~2k token cap. **Current inline location:** spec §13.2.

## `client-context-draft-reply`

**Tier:** Opus. **Intent:** Andy clicks "Generate draft" or "Generate reply". **Cached context:** conversation_summary + Brand DNA + open action items + deal stage + invoice status. **Reply target:** last 3 messages. **Output:** channel-formatted draft text. ~8k token cap. **Current inline location:** spec §13.3.

## `client-context-regenerate-draft-with-nudge`

**Tier:** Opus. **Intent:** Andy types a nudge field and submits. **Input:** same as draft-reply + previous draft + nudge instruction + nudge history. **Output:** revised draft. ~10k token cap. **Current inline location:** spec §13.4.

## `client-context-reformat-draft-for-channel`

**Tier:** Haiku. **Intent:** Andy clicks channel switcher on the draft drawer; reformat existing draft for target channel (email ↔ SMS). ~2k token cap. **Current inline location:** spec §13.5.
