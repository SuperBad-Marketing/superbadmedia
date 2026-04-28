-- Self-curated music library
CREATE TABLE IF NOT EXISTS music_library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  artist TEXT,
  file_url TEXT NOT NULL,
  cloudinary_public_id TEXT,
  duration_sec INTEGER,
  bpm INTEGER,
  mood TEXT,
  tags_json TEXT,
  use_count INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS ml_mood_idx ON music_library(mood);
CREATE INDEX IF NOT EXISTS ml_use_idx ON music_library(use_count);

-- Multi-scene support for video_jobs
ALTER TABLE video_jobs ADD COLUMN scene_count INTEGER DEFAULT 1;
ALTER TABLE video_jobs ADD COLUMN scenes_json TEXT;
ALTER TABLE video_jobs ADD COLUMN music_track_id TEXT;
ALTER TABLE video_jobs ADD COLUMN music_url TEXT;
