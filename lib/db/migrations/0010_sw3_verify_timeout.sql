-- SW-3 — settings-key seed: wizards.verify_timeout_ms.
-- Consumed by lib/wizards/verify-completion.ts. Source of truth:
-- docs/settings-registry.md (Wizards section). Per AUTONOMY_PROTOCOL.md
-- §G4, no timeout literal in code — completion verify() runs inside this.

INSERT OR IGNORE INTO `settings` (`key`, `value`, `type`, `description`, `updated_at_ms`) VALUES
  ('wizards.verify_timeout_ms', '4000', 'integer', 'completion-contract verify() timeout (ms)', 0);
