CREATE TABLE IF NOT EXISTS `medicine_rules` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `synonyms_json` text NOT NULL DEFAULT '[]',
  `level` integer NOT NULL,
  `category` text NOT NULL,
  `basis` text NOT NULL,
  `source_ids_json` text NOT NULL DEFAULT '[]',
  `review_required` integer NOT NULL DEFAULT 0,
  `condition` text,
  `enabled` integer NOT NULL DEFAULT 1,
  `updated_by` text,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS `medicine_rules_level_idx` ON `medicine_rules` (`level`);

CREATE TABLE IF NOT EXISTS `medicine_reviews` (
  `id` text PRIMARY KEY NOT NULL,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` text NOT NULL DEFAULT 'pending',
  `medicine_name` text,
  `ocr_text` text NOT NULL,
  `matched_rule_ids_json` text NOT NULL DEFAULT '[]',
  `proposed_level` integer NOT NULL,
  `confidence` integer NOT NULL DEFAULT 0,
  `note` text,
  `admin_note` text,
  `decision` text,
  `reviewed_by` text,
  `reviewed_at` text,
  `public_token_hash` text
);
CREATE INDEX IF NOT EXISTS `medicine_reviews_status_idx` ON `medicine_reviews` (`status`, `created_at`);

CREATE TABLE IF NOT EXISTS `medicine_audit_log` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `actor` text NOT NULL,
  `action` text NOT NULL,
  `target` text NOT NULL,
  `detail_json` text NOT NULL DEFAULT '{}',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `medicine_settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `medicine_rate_limits` (
  `key` text PRIMARY KEY NOT NULL,
  `count` integer NOT NULL DEFAULT 1,
  `expires_at` integer NOT NULL
);
