-- Content Studio — internal tool for brand content creation
CREATE TABLE IF NOT EXISTS content_studio_posts (
  id TEXT PRIMARY KEY,
  brief TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'announcement',
  template_id TEXT NOT NULL,
  generated_copy_json TEXT,
  correction_history_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS csp_type_idx ON content_studio_posts(content_type);
CREATE INDEX IF NOT EXISTS csp_status_idx ON content_studio_posts(status);
CREATE INDEX IF NOT EXISTS csp_created_idx ON content_studio_posts(created_at_ms);

CREATE TABLE IF NOT EXISTS content_studio_renders (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES content_studio_posts(id) ON DELETE CASCADE,
  aspect_ratio TEXT NOT NULL,
  platforms TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  cloudinary_public_id TEXT,
  cloudinary_url TEXT,
  render_status TEXT NOT NULL DEFAULT 'rendering',
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS csr_post_idx ON content_studio_renders(post_id);
