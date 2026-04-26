-- Expand braindumps to track content + script counts
ALTER TABLE braindumps ADD COLUMN content_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE braindumps ADD COLUMN script_count INTEGER NOT NULL DEFAULT 0;

-- Content studio posts can originate from a braindump
ALTER TABLE content_studio_posts ADD COLUMN source_braindump_id TEXT;
CREATE INDEX csp_braindump_idx ON content_studio_posts (source_braindump_id);

-- Talking head session packs can originate from a braindump
ALTER TABLE talking_head_session_packs ADD COLUMN source_braindump_id TEXT;

-- Talking head scripts can originate from a braindump
ALTER TABLE talking_head_scripts ADD COLUMN source_braindump_id TEXT;
CREATE INDEX th_scripts_braindump_idx ON talking_head_scripts (source_braindump_id);
