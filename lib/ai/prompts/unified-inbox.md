---
spec: docs/specs/unified-inbox.md
status: stub
populated-by: Unified Inbox content mini-session
---

# Unified Inbox prompts

All three are Haiku. Run in parallel for every inbound message (cost negligible, latency sub-2-second). Classifications stored on the message row; corrections feed back as learning signal.

## `inbox-classify-inbound-route`
**Intent:** contact resolution + sender-type classification (known / new-lead / non-client / spam). **Current inline location:** spec §Q5.

## `inbox-classify-notification-priority`
**Intent:** interruption priority (urgent / push / silent). **Current inline location:** spec §Q10.

## `inbox-classify-signal-noise`
**Intent:** content priority (signal / noise / spam) with noise sub-classification (transactional / marketing / automated / update). **Current inline location:** spec §Q12.
