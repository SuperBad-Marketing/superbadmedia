-- QB-7: split `expires_at_ms` (scheduled expiry) from `expired_at_ms`
-- (actual transition timestamp). Prior to this, `handleQuoteExpire`
-- overwrote `expires_at_ms` with Date.now() at transition time,
-- clobbering the original schedule. New column is nullable; populated
-- only when the row enters status='expired'.
--
-- Reversible:
--   ALTER TABLE `quotes` DROP COLUMN `expired_at_ms`;

ALTER TABLE `quotes` ADD COLUMN `expired_at_ms` integer;
