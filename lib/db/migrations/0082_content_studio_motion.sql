-- Content Studio motion graphics support

-- New columns on content_studio_posts for motion state
ALTER TABLE content_studio_posts ADD COLUMN motion_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE content_studio_posts ADD COLUMN motion_template_id TEXT;
ALTER TABLE content_studio_posts ADD COLUMN palette_id TEXT;
ALTER TABLE content_studio_posts ADD COLUMN animation_params_json TEXT;
ALTER TABLE content_studio_posts ADD COLUMN primary_aspect_ratio TEXT;
ALTER TABLE content_studio_posts ADD COLUMN inspiration_refs_json TEXT;

-- New columns on content_studio_renders for motion output tracking
ALTER TABLE content_studio_renders ADD COLUMN render_type TEXT NOT NULL DEFAULT 'static';
ALTER TABLE content_studio_renders ADD COLUMN format TEXT NOT NULL DEFAULT 'png';
ALTER TABLE content_studio_renders ADD COLUMN video_job_id TEXT;

-- Link video_jobs back to content studio posts
ALTER TABLE video_jobs ADD COLUMN content_studio_post_id TEXT;

-- Inspiration reference library
CREATE TABLE IF NOT EXISTS inspiration_library (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  description TEXT,
  tags TEXT,
  created_at_ms INTEGER NOT NULL
);
