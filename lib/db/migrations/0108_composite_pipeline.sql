-- Composite pipeline fields for video_jobs — stage tracking, overlay config, trim, composited output
ALTER TABLE video_jobs ADD COLUMN pipeline_stage TEXT DEFAULT 'brief';
ALTER TABLE video_jobs ADD COLUMN overlay_template_id TEXT;
ALTER TABLE video_jobs ADD COLUMN overlay_copy_json TEXT;
ALTER TABLE video_jobs ADD COLUMN overlay_params_json TEXT;
ALTER TABLE video_jobs ADD COLUMN trim_in_frame INTEGER DEFAULT 0;
ALTER TABLE video_jobs ADD COLUMN trim_out_frame INTEGER;
ALTER TABLE video_jobs ADD COLUMN footage_url TEXT;
ALTER TABLE video_jobs ADD COLUMN overlay_url TEXT;
ALTER TABLE video_jobs ADD COLUMN composite_url TEXT;
