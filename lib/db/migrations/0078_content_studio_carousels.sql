-- Content Studio carousel support — multiple slides per post
ALTER TABLE content_studio_posts ADD COLUMN slide_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE content_studio_renders ADD COLUMN slide_index INTEGER NOT NULL DEFAULT 0;
