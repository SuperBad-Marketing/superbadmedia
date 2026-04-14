import fs from "node:fs";
import path from "node:path";
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { runSeeds } from "@/lib/db/migrate";
import { eq } from "drizzle-orm";
import { scheduled_tasks } from "@/lib/db/schema/scheduled-tasks";
import { wizard_progress } from "@/lib/db/schema/wizard-progress";
import { activity_log } from "@/lib/db/schema/activity-log";
import { user } from "@/lib/db/schema/user";
import { killSwitches, resetKillSwitchesToDefaults } from "@/lib/kill-switches";

const sendEmailMock = vi.fn(
  async (params: Record<string, unknown>) => {
    void params;
    return { sent: true, messageId: "mock-id" };
  },
);
vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: (params: Record<string, unknown>) => sendEmailMock(params),
}));

const TEST_DB = path.join(process.cwd(), "tests/.test-wizard-nudge.db");

let sqlite: Database.Database;

const USER_ID = "user-nudge-1";
const USER_EMAIL = "test+nudge@example.com";
const PROGRESS_ID = "wp-nudge-1";
const WIZARD_KEY = "stripe-admin";

function nowMs(): number {
  return Date.now();
}

async function seedUser(): Promise<void> {
  const d = drizzle(sqlite);
  await d.insert(user).values({
    id: USER_ID,
    email: USER_EMAIL,
    role: "admin",
    created_at_ms: nowMs(),
  });
}

async function seedProgress(overrides: Partial<{
  id: string;
  lastActiveAtMs: number;
  expiresAtMs: number;
  abandonedAtMs: number | null;
}> = {}): Promise<string> {
  const d = drizzle(sqlite);
  const id = overrides.id ?? PROGRESS_ID;
  const started = nowMs() - 5 * 24 * 60 * 60 * 1000;
  await d.insert(wizard_progress).values({
    id,
    wizard_key: WIZARD_KEY,
    user_id: USER_ID,
    audience: "admin",
    current_step: 1,
    step_state: null,
    started_at_ms: started,
    last_active_at_ms: overrides.lastActiveAtMs ?? started,
    abandoned_at_ms: overrides.abandonedAtMs ?? null,
    expires_at_ms: overrides.expiresAtMs ?? started + 30 * 24 * 60 * 60 * 1000,
    resumed_count: 0,
  });
  return id;
}

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const d = drizzle(sqlite);
  const migrationsFolder = path.join(process.cwd(), "lib/db/migrations");
  drizzleMigrate(d, { migrationsFolder });
  runSeeds(sqlite, migrationsFolder);
  const globalForDb = globalThis as unknown as {
    __sblite_sqlite?: Database.Database;
  };
  globalForDb.__sblite_sqlite = sqlite;
});

beforeEach(async () => {
  resetKillSwitchesToDefaults();
  sendEmailMock.mockClear();
  sqlite.exec("DELETE FROM scheduled_tasks");
  sqlite.exec("DELETE FROM activity_log");
  sqlite.exec("DELETE FROM wizard_progress");
  sqlite.exec("DELETE FROM user");
  await seedUser();
});

afterAll(() => {
  sqlite.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

describe("scheduleWizardNudges", () => {
  it("enqueues resume-nudge + expiry-warn + expire with correct fire times", async () => {
    const { scheduleWizardNudges } = await import(
      "@/lib/wizards/nudge/enqueue"
    );
    const lastActive = nowMs();
    const expires = lastActive + 30 * 24 * 60 * 60 * 1000;
    await seedProgress({ lastActiveAtMs: lastActive, expiresAtMs: expires });
    await scheduleWizardNudges({
      id: PROGRESS_ID,
      last_active_at_ms: lastActive,
      expires_at_ms: expires,
    });

    const rows = await drizzle(sqlite).select().from(scheduled_tasks);
    expect(rows).toHaveLength(3);
    const byType = Object.fromEntries(rows.map((r) => [r.task_type, r]));
    expect(byType["wizard_resume_nudge"]?.run_at_ms).toBe(
      lastActive + 24 * 60 * 60 * 1000,
    );
    expect(byType["wizard_expiry_warn"]?.run_at_ms).toBe(
      expires - 24 * 60 * 60 * 1000,
    );
    expect(byType["wizard_expire"]?.run_at_ms).toBe(expires);
    expect(byType["wizard_resume_nudge"]?.idempotency_key).toBe(
      `wizard_resume_nudge:${PROGRESS_ID}:${lastActive}`,
    );
  });

  it("new resume-nudge row is created on activity update (different idempotency_key)", async () => {
    const { scheduleWizardNudges } = await import(
      "@/lib/wizards/nudge/enqueue"
    );
    const base = nowMs();
    const expires = base + 30 * 24 * 60 * 60 * 1000;
    await seedProgress({ lastActiveAtMs: base, expiresAtMs: expires });
    await scheduleWizardNudges({
      id: PROGRESS_ID,
      last_active_at_ms: base,
      expires_at_ms: expires,
    });
    // Activity update → re-schedule with new last_active_at_ms
    await scheduleWizardNudges({
      id: PROGRESS_ID,
      last_active_at_ms: base + 60_000,
      expires_at_ms: expires,
    });

    const resumeRows = await drizzle(sqlite)
      .select()
      .from(scheduled_tasks)
      .where(eq(scheduled_tasks.task_type, "wizard_resume_nudge"));
    expect(resumeRows).toHaveLength(2);
    // expiry_warn + expire stay at 1 each (idempotent on progressId alone).
    const allRows = await drizzle(sqlite).select().from(scheduled_tasks);
    expect(allRows).toHaveLength(4);
  });
});

describe("cancelWizardNudges", () => {
  it("deletes only pending rows for the given progressId", async () => {
    const { scheduleWizardNudges, cancelWizardNudges } = await import(
      "@/lib/wizards/nudge/enqueue"
    );
    const now = nowMs();
    const expires = now + 30 * 24 * 60 * 60 * 1000;
    await seedProgress({ lastActiveAtMs: now, expiresAtMs: expires });
    await scheduleWizardNudges({
      id: PROGRESS_ID,
      last_active_at_ms: now,
      expires_at_ms: expires,
    });
    // Another progress row's tasks must survive. Use a different wizard_key
    // to clear the partial-unique (user_id, wizard_key) index.
    const other = "wp-other";
    const d = drizzle(sqlite);
    await d.insert(wizard_progress).values({
      id: other,
      wizard_key: "resend",
      user_id: USER_ID,
      audience: "admin",
      current_step: 0,
      step_state: null,
      started_at_ms: now,
      last_active_at_ms: now,
      abandoned_at_ms: null,
      expires_at_ms: expires,
      resumed_count: 0,
    });
    await scheduleWizardNudges({
      id: other,
      last_active_at_ms: now,
      expires_at_ms: expires,
    });

    await cancelWizardNudges(PROGRESS_ID);

    const remaining = await drizzle(sqlite).select().from(scheduled_tasks);
    expect(remaining).toHaveLength(3);
    for (const row of remaining) {
      expect(row.idempotency_key).toContain(other);
    }
  });
});

describe("handleWizardResumeNudge", () => {
  it("no-ops when wizards_nudges_enabled is off", async () => {
    const { handleWizardResumeNudge } = await import(
      "@/lib/wizards/nudge/handlers"
    );
    await seedProgress();
    await handleWizardResumeNudge({
      id: "t1",
      task_type: "wizard_resume_nudge",
      run_at_ms: 0,
      payload: { progressId: PROGRESS_ID },
      status: "running",
      attempts: 1,
      last_attempted_at_ms: nowMs(),
      last_error: null,
      idempotency_key: null,
      created_at_ms: nowMs(),
      done_at_ms: null,
      reclaimed_at_ms: null,
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sends transactional email when the row is still live", async () => {
    killSwitches.wizards_nudges_enabled = true;
    const { handleWizardResumeNudge } = await import(
      "@/lib/wizards/nudge/handlers"
    );
    const last = nowMs();
    await seedProgress({ lastActiveAtMs: last });
    await handleWizardResumeNudge({
      id: "t1",
      task_type: "wizard_resume_nudge",
      run_at_ms: 0,
      payload: {
        progressId: PROGRESS_ID,
        scheduledForLastActiveAtMs: last,
      },
      status: "running",
      attempts: 1,
      last_attempted_at_ms: nowMs(),
      last_error: null,
      idempotency_key: null,
      created_at_ms: nowMs(),
      done_at_ms: null,
      reclaimed_at_ms: null,
    });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const args = sendEmailMock.mock.calls[0][0] as unknown as {
      to: string;
      classification: string;
      purpose: string;
    };
    expect(args.to).toBe(USER_EMAIL);
    expect(args.classification).toBe("transactional");
    expect(args.purpose).toContain(WIZARD_KEY);
  });

  it("skips silently when last_active_at_ms has advanced (stale task)", async () => {
    killSwitches.wizards_nudges_enabled = true;
    const { handleWizardResumeNudge } = await import(
      "@/lib/wizards/nudge/handlers"
    );
    const scheduledAt = nowMs() - 60_000;
    await seedProgress({ lastActiveAtMs: scheduledAt + 30_000 });
    await handleWizardResumeNudge({
      id: "t1",
      task_type: "wizard_resume_nudge",
      run_at_ms: 0,
      payload: {
        progressId: PROGRESS_ID,
        scheduledForLastActiveAtMs: scheduledAt,
      },
      status: "running",
      attempts: 1,
      last_attempted_at_ms: nowMs(),
      last_error: null,
      idempotency_key: null,
      created_at_ms: nowMs(),
      done_at_ms: null,
      reclaimed_at_ms: null,
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("skips silently when the row is abandoned", async () => {
    killSwitches.wizards_nudges_enabled = true;
    const { handleWizardResumeNudge } = await import(
      "@/lib/wizards/nudge/handlers"
    );
    await seedProgress({ abandonedAtMs: nowMs() });
    await handleWizardResumeNudge({
      id: "t1",
      task_type: "wizard_resume_nudge",
      run_at_ms: 0,
      payload: { progressId: PROGRESS_ID },
      status: "running",
      attempts: 1,
      last_attempted_at_ms: nowMs(),
      last_error: null,
      idempotency_key: null,
      created_at_ms: nowMs(),
      done_at_ms: null,
      reclaimed_at_ms: null,
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("handleWizardExpire", () => {
  it("marks the row abandoned and logs a wizard_abandoned activity", async () => {
    const { handleWizardExpire } = await import("@/lib/wizards/nudge/handlers");
    await seedProgress();
    await handleWizardExpire({
      id: "t1",
      task_type: "wizard_expire",
      run_at_ms: 0,
      payload: { progressId: PROGRESS_ID },
      status: "running",
      attempts: 1,
      last_attempted_at_ms: nowMs(),
      last_error: null,
      idempotency_key: null,
      created_at_ms: nowMs(),
      done_at_ms: null,
      reclaimed_at_ms: null,
    });

    const rows = await drizzle(sqlite)
      .select()
      .from(wizard_progress)
      .where(eq(wizard_progress.id, PROGRESS_ID));
    expect(rows[0]?.abandoned_at_ms).not.toBeNull();

    const events = await drizzle(sqlite)
      .select()
      .from(activity_log)
      .where(eq(activity_log.kind, "wizard_abandoned"));
    expect(events).toHaveLength(1);
  });

  it("runs regardless of the nudge kill-switch", async () => {
    expect(killSwitches.wizards_nudges_enabled).toBe(false);
    const { handleWizardExpire } = await import("@/lib/wizards/nudge/handlers");
    await seedProgress();
    await handleWizardExpire({
      id: "t1",
      task_type: "wizard_expire",
      run_at_ms: 0,
      payload: { progressId: PROGRESS_ID },
      status: "running",
      attempts: 1,
      last_attempted_at_ms: nowMs(),
      last_error: null,
      idempotency_key: null,
      created_at_ms: nowMs(),
      done_at_ms: null,
      reclaimed_at_ms: null,
    });
    const rows = await drizzle(sqlite)
      .select()
      .from(wizard_progress)
      .where(eq(wizard_progress.id, PROGRESS_ID));
    expect(rows[0]?.abandoned_at_ms).not.toBeNull();
  });
});

describe("integration: schedule → fire all three via worker", () => {
  it("nudge + warn send emails; expire marks row abandoned", async () => {
    killSwitches.wizards_nudges_enabled = true;
    killSwitches.scheduled_tasks_enabled = true;

    const { scheduleWizardNudges } = await import(
      "@/lib/wizards/nudge/enqueue"
    );
    const { wizardNudgeHandlers } = await import(
      "@/lib/wizards/nudge/handlers"
    );
    const { tick } = await import("@/lib/scheduled-tasks/worker");

    const last = nowMs() - 2 * 60 * 60 * 1000; // 2h ago, so tasks all due
    const expires = nowMs() - 1000; // already expired
    await seedProgress({ lastActiveAtMs: last, expiresAtMs: expires });
    await scheduleWizardNudges({
      id: PROGRESS_ID,
      last_active_at_ms: last,
      expires_at_ms: expires,
    });
    // Rewind run_at so all three are due.
    sqlite
      .prepare("UPDATE scheduled_tasks SET run_at_ms = ?")
      .run(nowMs() - 60_000);

    const processed = await tick(wizardNudgeHandlers);
    expect(processed).toBe(3);

    expect(sendEmailMock).toHaveBeenCalledTimes(2); // nudge + warn

    const rows = await drizzle(sqlite)
      .select()
      .from(wizard_progress)
      .where(eq(wizard_progress.id, PROGRESS_ID));
    expect(rows[0]?.abandoned_at_ms).not.toBeNull();
  });
});
