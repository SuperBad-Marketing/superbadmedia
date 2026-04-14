-- QB-4c: stamp which legal_doc_versions the client agreed to at Accept time.
-- Both columns are nullable to keep the migration additive; the app writes
-- them in the same tx as the `sent|viewed → accepted` transition.
-- Reversible:
--   ALTER TABLE `quotes` DROP COLUMN `accepted_tos_version_id`;
--   ALTER TABLE `quotes` DROP COLUMN `accepted_privacy_version_id`;

ALTER TABLE `quotes` ADD COLUMN `accepted_tos_version_id` text REFERENCES `legal_doc_versions`(`id`);
--> statement-breakpoint
ALTER TABLE `quotes` ADD COLUMN `accepted_privacy_version_id` text REFERENCES `legal_doc_versions`(`id`);
