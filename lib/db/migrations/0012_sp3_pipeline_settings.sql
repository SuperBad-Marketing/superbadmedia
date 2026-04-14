-- SP-3: seed Sales Pipeline stale-threshold + snooze-default settings keys.
-- Source of truth: docs/settings-registry.md (Sales Pipeline block).
-- Reversible: DELETE FROM settings WHERE key LIKE 'pipeline.%';

INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('pipeline.stale_thresholds.lead_days', '14', 'integer', 'Days in lead stage before stale halo fires', 0),
  ('pipeline.stale_thresholds.contacted_days', '5', 'integer', 'Days in contacted stage before stale halo fires', 0),
  ('pipeline.stale_thresholds.conversation_days', '7', 'integer', 'Days in conversation stage before stale halo fires', 0),
  ('pipeline.stale_thresholds.trial_shoot_days', '14', 'integer', 'Days in trial_shoot stage before stale halo fires', 0),
  ('pipeline.stale_thresholds.quoted_days', '5', 'integer', 'Days in quoted stage before stale halo fires', 0),
  ('pipeline.stale_thresholds.negotiating_days', '3', 'integer', 'Days in negotiating stage before stale halo fires', 0),
  ('pipeline.snooze_default_days', '3', 'integer', 'Default snooze duration when Andy snoozes a stale deal', 0);
