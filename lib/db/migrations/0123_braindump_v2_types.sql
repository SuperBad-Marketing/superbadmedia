-- Braindump v2: type selector + content pipeline + ideas mode
ALTER TABLE braindumps ADD COLUMN type TEXT NOT NULL DEFAULT 'general';
ALTER TABLE braindumps ADD COLUMN blog_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE braindumps ADD COLUMN project_count INTEGER NOT NULL DEFAULT 0;

-- Blog posts: provenance tracking from braindump
ALTER TABLE blog_posts ADD COLUMN source_braindump_id TEXT REFERENCES braindumps(id);

-- Content topics: provenance tracking from braindump
ALTER TABLE content_topics ADD COLUMN source_braindump_id TEXT REFERENCES braindumps(id);
