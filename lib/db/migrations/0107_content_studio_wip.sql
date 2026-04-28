-- Add project name and format tracking for WIP / unified studio workflow
ALTER TABLE content_studio_posts ADD COLUMN project_name TEXT;
ALTER TABLE content_studio_posts ADD COLUMN content_format TEXT DEFAULT 'static';
