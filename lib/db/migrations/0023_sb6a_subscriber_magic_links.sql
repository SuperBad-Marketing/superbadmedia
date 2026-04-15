-- SB-6a: subscriber magic-link tokens. One-time login links issued to
-- SaaS subscribers on first successful payment (and on-demand via the
-- welcome page). Separate from `portal_magic_links` — that table is
-- contact-scoped (non-converter portal + intro funnel). This one is
-- user-scoped because redeem must promote `user.role` prospect→client
-- and create an Auth.js session.
CREATE TABLE IF NOT EXISTS subscriber_magic_link_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  issued_for TEXT NOT NULL DEFAULT 'subscriber_login',
  expires_at_ms INTEGER NOT NULL,
  consumed_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS subscriber_magic_link_tokens_user_idx
  ON subscriber_magic_link_tokens (user_id, created_at_ms);
CREATE INDEX IF NOT EXISTS subscriber_magic_link_tokens_token_hash_idx
  ON subscriber_magic_link_tokens (token_hash);
