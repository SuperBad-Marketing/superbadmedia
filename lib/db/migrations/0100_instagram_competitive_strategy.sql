-- Instagram Competitive Strategy Engine tables
-- Spec: docs/specs/instagram-competitive-strategy.md

CREATE TABLE IF NOT EXISTS instagram_watched_accounts (
  id                  TEXT PRIMARY KEY,
  username            TEXT NOT NULL UNIQUE,
  display_name        TEXT,
  category            TEXT NOT NULL DEFAULT 'wildcard',
  followers           INTEGER,
  bio                 TEXT,
  profile_pic_url     TEXT,
  last_scraped_at_ms  INTEGER,
  posts_scraped       INTEGER NOT NULL DEFAULT 0,
  avg_engagement_rate REAL,
  added_at_ms         INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active'
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS ig_watched_status_idx ON instagram_watched_accounts(status);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS instagram_competitor_posts (
  id                  TEXT PRIMARY KEY,
  watched_account_id  TEXT NOT NULL REFERENCES instagram_watched_accounts(id) ON DELETE CASCADE,
  ig_permalink        TEXT,
  media_type          TEXT NOT NULL DEFAULT 'IMAGE',
  caption             TEXT,
  image_url           TEXT NOT NULL,
  likes               INTEGER NOT NULL DEFAULT 0,
  comments            INTEGER NOT NULL DEFAULT 0,
  post_er             REAL NOT NULL DEFAULT 0,
  performance_score   REAL NOT NULL DEFAULT 0,
  recency_weight      REAL NOT NULL DEFAULT 1.0,
  final_score         REAL NOT NULL DEFAULT 0,
  why_high            TEXT,
  published_at_ms     INTEGER NOT NULL,
  scraped_at_ms       INTEGER NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS ig_comp_posts_account_idx ON instagram_competitor_posts(watched_account_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS ig_comp_posts_score_idx ON instagram_competitor_posts(final_score);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS instagram_inspiration_reactions (
  id                  TEXT PRIMARY KEY,
  competitor_post_id  TEXT NOT NULL REFERENCES instagram_competitor_posts(id) ON DELETE CASCADE,
  reaction            TEXT NOT NULL,
  reacted_at_ms       INTEGER NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS ig_insp_reaction_unique_idx ON instagram_inspiration_reactions(competitor_post_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS instagram_taste_profiles (
  id                       TEXT PRIMARY KEY,
  generated_at_ms          INTEGER NOT NULL,
  reaction_count           INTEGER NOT NULL DEFAULT 0,
  preferred_types_json     TEXT,
  preferred_styles_json    TEXT,
  preferred_topics_json    TEXT,
  anti_patterns_json       TEXT,
  raw_analysis_text        TEXT
);
--> statement-breakpoint

-- Braindump mood signal column
ALTER TABLE braindumps ADD COLUMN mood_signal_json TEXT;
