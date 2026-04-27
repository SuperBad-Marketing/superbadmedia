ALTER TABLE content_studio_posts ADD COLUMN font_pairing_id TEXT;
ALTER TABLE content_studio_posts ADD COLUMN static_palette_id TEXT;
ALTER TABLE content_studio_posts ADD COLUMN custom_palette_json TEXT;
ALTER TABLE content_studio_posts ADD COLUMN motion_duration_frames INTEGER;
ALTER TABLE content_studio_posts ADD COLUMN promoted_from_post_id TEXT REFERENCES content_studio_posts(id);
