/**
 * Permissions module — derived from the Phase 3.5 access matrix.
 *
 * The matrix itself wasn't compiled into a single document in Phase 3.5;
 * only `docs/specs/finance-dashboard.md` §13 contributed its rules. Each
 * subsequent wave's session extends the rules here for its own routes
 * (logged as a PATCHES_OWED precondition on every owning session).
 *
 * Usage:
 *   if (!can(session.user.role, "GET", "/lite/finance/expenses")) return 403
 *
 * `system` is reserved for cron-initiated actions. Never attached to an
 * interactive session — cron handlers call `can('system', ...)` explicitly.
 */

export const ROLES = [
  "admin",
  "client",
  "prospect",
  "anonymous",
  "system",
] as const;
export type Role = (typeof ROLES)[number];

export type HttpAction = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type CronAction = "CRON";
export type Action = HttpAction | CronAction;

type RuleMatcher = {
  action: Action;
  /**
   * Pattern matched against the resource string. Supports exact match or
   * a `:` parameter segment (e.g. `/lite/finance/expenses/:id`).
   */
  resource: string;
  roles: ReadonlySet<Role>;
};

// Build a rule from a compact declaration.
const rule = (
  action: Action,
  resource: string,
  roles: readonly Role[],
): RuleMatcher => ({
  action,
  resource,
  roles: new Set(roles),
});

/**
 * Access matrix — each row pairs (action + resource) with the set of
 * roles allowed. Order doesn't matter; lookup is O(n).
 *
 * Seeded from Finance Dashboard §13 as the only Phase 3.5 contribution.
 * Extend here as each wave lands its own routes + cron jobs.
 */
const RULES: readonly RuleMatcher[] = [
  // Finance Dashboard §13
  rule("GET", "/lite/finance/*", ["admin"]),
  rule("POST", "/lite/finance/expenses", ["admin"]),
  rule("PUT", "/lite/finance/expenses/:id", ["admin"]),
  rule("POST", "/lite/finance/recurring", ["admin"]),
  rule("POST", "/lite/finance/export", ["admin"]),
  rule("GET", "/lite/finance/exports/:file", ["admin"]),
  rule("CRON", "finance_snapshot_take", ["system"]),
  rule("CRON", "finance_narrative_regenerate", ["system"]),
  rule("CRON", "finance_observatory_rollup", ["system"]),
  rule("CRON", "finance_stripe_fee_rollup", ["system"]),
  rule("CRON", "recurring_expense_book", ["system"]),
  rule("CRON", "finance_export_generate", ["system"]),
];

/**
 * Match a resource against a pattern. Supports:
 *   - exact equality
 *   - `*` as a trailing wildcard segment (`/lite/finance/*`)
 *   - `:param` single-segment parameters (`/lite/finance/expenses/:id`)
 */
function matches(pattern: string, resource: string): boolean {
  if (pattern === resource) return true;

  const patternParts = pattern.split("/");
  const resourceParts = resource.split("/");

  if (patternParts.length !== resourceParts.length) {
    const last = patternParts[patternParts.length - 1];
    if (last !== "*") return false;
    for (let i = 0; i < patternParts.length - 1; i++) {
      if (!segmentMatch(patternParts[i], resourceParts[i])) return false;
    }
    return resourceParts.length >= patternParts.length;
  }

  for (let i = 0; i < patternParts.length; i++) {
    if (!segmentMatch(patternParts[i], resourceParts[i])) return false;
  }
  return true;
}

function segmentMatch(patternSeg: string, resourceSeg: string): boolean {
  if (patternSeg === "*") return true;
  if (patternSeg.startsWith(":")) return resourceSeg !== undefined;
  return patternSeg === resourceSeg;
}

/**
 * Returns true if `role` may perform `action` on `resource`.
 * Default-deny: any rule miss returns false.
 */
export function can(role: Role, action: Action, resource: string): boolean {
  for (const r of RULES) {
    if (r.action === action && matches(r.resource, resource)) {
      return r.roles.has(role);
    }
  }
  return false;
}

export const PERMISSION_RULES = RULES;
