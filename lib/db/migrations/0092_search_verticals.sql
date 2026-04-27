-- Search verticals for lead gen rotation
CREATE TABLE IF NOT EXISTS `search_verticals` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `category` text NOT NULL,
  `location` text NOT NULL,
  `location_lat` real NOT NULL,
  `location_lng` real NOT NULL,
  `radius_km` integer NOT NULL,
  `country_code` text NOT NULL DEFAULT 'AU',
  `standing_brief` text,
  `weight` integer NOT NULL DEFAULT 5,
  `is_active` integer NOT NULL DEFAULT 1,
  `last_searched_at` integer,
  `search_count` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `search_verticals_active_searched_idx`
  ON `search_verticals` (`is_active`, `last_searched_at`);

-- Add vertical tracking to lead_runs
ALTER TABLE `lead_runs` ADD COLUMN `vertical_id` text;
ALTER TABLE `lead_runs` ADD COLUMN `vertical_name` text;
