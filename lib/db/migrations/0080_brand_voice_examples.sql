CREATE TABLE IF NOT EXISTS brand_voice_examples (
  id TEXT PRIMARY KEY NOT NULL,
  surface TEXT NOT NULL,
  title TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS brand_voice_examples_surface_order_idx
  ON brand_voice_examples (surface, sort_order);
