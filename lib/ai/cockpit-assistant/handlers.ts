import { eq, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { deals, type DealStage } from "@/lib/db/schema/deals";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { quotes, type QuoteStatus } from "@/lib/db/schema/quotes";
import { expenses } from "@/lib/db/schema/expenses";
import { listTasks, createTask } from "@/lib/tasks/queries";
import { getTodayCalendarEvents } from "@/lib/cockpit/queries";
import type { TaskPriority, TaskKind, TaskStatus } from "@/lib/db/schema/tasks";

type ToolResult = { result: string };

function money(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;
}

function fmtDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function handleToolCall(
  name: string,
  input: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  switch (name) {
    case "list_deals":
      return listDeals(input);
    case "get_deal_details":
      return getDealDetails(input);
    case "list_tasks":
      return listTasksHandler(input);
    case "get_finance_summary":
      return getFinanceSummary(input);
    case "list_recent_expenses":
      return listRecentExpenses(input);
    case "list_clients":
      return listClients(input);
    case "get_calendar_today":
      return getCalendarToday();
    case "list_quotes":
      return listQuotesHandler(input);
    case "create_task":
      return createTaskHandler(input, userId);
    case "add_expense":
      return addExpenseHandler(input);
    default:
      return { result: `Unknown tool: ${name}` };
  }
}

async function listDeals(
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(input.limit) || 20, 50);
  let query = db
    .select({
      id: deals.id,
      title: deals.title,
      stage: deals.stage,
      value_cents: deals.value_cents,
      company_id: deals.company_id,
      next_action_text: deals.next_action_text,
      updated_at_ms: deals.updated_at_ms,
    })
    .from(deals)
    .orderBy(desc(deals.updated_at_ms))
    .limit(limit);

  if (input.stage && typeof input.stage === "string") {
    query = query.where(eq(deals.stage, input.stage as DealStage)) as typeof query;
  }

  const rows = query.all();

  const companyIds = [...new Set(rows.map((r) => r.company_id).filter(Boolean))];
  const companyMap = new Map<string, string>();
  if (companyIds.length) {
    const companyRows = db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(inArray(companies.id, companyIds as string[]))
      .all();
    for (const c of companyRows) companyMap.set(c.id, c.name);
  }

  const lines = rows.map(
    (d) =>
      `• ${d.title} | ${d.stage} | ${money(d.value_cents)} | ${companyMap.get(d.company_id ?? "") ?? "—"} | ${d.next_action_text ?? "no next action"} | updated ${fmtDate(d.updated_at_ms)}`,
  );

  return {
    result: rows.length
      ? `${rows.length} deal(s):\n${lines.join("\n")}`
      : "No deals found.",
  };
}

async function getDealDetails(
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const dealId = String(input.deal_id);
  const [deal] = db
    .select()
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1)
    .all();
  if (!deal) return { result: "Deal not found." };

  const company = deal.company_id
    ? db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, deal.company_id))
        .get()
    : null;

  const contactRows = deal.company_id
    ? db
        .select({ name: contacts.name, email: contacts.email, role: contacts.role })
        .from(contacts)
        .where(eq(contacts.company_id, deal.company_id))
        .all()
    : [];

  const quoteRows = db
    .select({
      quote_number: quotes.quote_number,
      status: quotes.status,
      total_cents_inc_gst: quotes.total_cents_inc_gst,
      structure: quotes.structure,
      created_at_ms: quotes.created_at_ms,
    })
    .from(quotes)
    .where(eq(quotes.deal_id, dealId))
    .orderBy(desc(quotes.created_at_ms))
    .all();

  const contactList = contactRows
    .map((c) => `  ${c.name} (${c.role ?? "no role"}) — ${c.email ?? "no email"}`)
    .join("\n");

  const quoteList = quoteRows
    .map(
      (q) =>
        `  ${q.quote_number} | ${q.status} | ${money(q.total_cents_inc_gst)} | ${q.structure} | ${fmtDate(q.created_at_ms)}`,
    )
    .join("\n");

  return {
    result: [
      `Deal: ${deal.title}`,
      `Stage: ${deal.stage}`,
      `Value: ${money(deal.value_cents)}`,
      `Company: ${company?.name ?? "—"}`,
      `Next action: ${deal.next_action_text ?? "—"}`,
      `Contacts:\n${contactList || "  (none)"}`,
      `Quotes:\n${quoteList || "  (none)"}`,
    ].join("\n"),
  };
}

async function listTasksHandler(
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const statusFilter: TaskStatus[] = Array.isArray(input.status)
    ? input.status as TaskStatus[]
    : ["todo", "in_progress", "blocked"];

  const rows = await listTasks({
    status: statusFilter,
    priority: input.priority
      ? ([input.priority] as TaskPriority[])
      : undefined,
  });

  const limited = rows.slice(0, Math.min(Number(input.limit) || 20, 50));

  const lines = limited.map(
    (t) =>
      `• [${t.priority ?? "normal"}] ${t.title} | ${t.status} | ${t.kind} | due ${t.due_at_ms ? fmtDate(t.due_at_ms) : "—"}`,
  );

  return {
    result: limited.length
      ? `${limited.length} task(s):\n${lines.join("\n")}`
      : "No tasks found matching that filter.",
  };
}

async function getFinanceSummary(
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const { computePandLSummary } = await import(
    "@/lib/finance/export-queries"
  );
  const { getAllPresets } = await import("@/lib/finance/export-periods");

  const presets = getAllPresets();
  const periodKey = typeof input.period === "string" ? input.period : "this_month";

  const presetMap: Record<string, number> = {
    this_month: 0,
    last_month: 1,
    this_quarter: 2,
    last_quarter: 3,
    this_fy: 4,
    last_fy: 5,
  };

  const idx = presetMap[periodKey] ?? 0;
  const period = presets[idx] ?? presets[0];

  const summary = await computePandLSummary(period);

  return {
    result: [
      `P&L — ${period.label}:`,
      `  Revenue (inc GST): ${money(summary.revenue_inc_gst)}`,
      `  Revenue (ex GST): ${money(summary.revenue_ex_gst)}`,
      `  Expenses (inc GST): ${money(summary.expenses_inc_gst)}`,
      `  Net profit (ex GST): ${money(summary.net_profit_ex_gst)}`,
    ].join("\n"),
  };
}

async function listRecentExpenses(
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(input.limit) || 15, 50);
  const rows = db
    .select({
      amount_inc_gst: expenses.amount_inc_gst,
      vendor: expenses.vendor,
      category: expenses.category,
      description: expenses.description,
      expense_date: expenses.expense_date,
    })
    .from(expenses)
    .orderBy(desc(expenses.expense_date))
    .limit(limit)
    .all();

  const lines = rows.map(
    (e) =>
      `• ${money(e.amount_inc_gst)} | ${e.vendor} | ${e.category} | ${e.description} | ${e.expense_date}`,
  );

  return {
    result: rows.length
      ? `${rows.length} recent expense(s):\n${lines.join("\n")}`
      : "No expenses found.",
  };
}

async function listClients(
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(input.limit) || 20, 50);
  const rows = db
    .select({
      id: companies.id,
      name: companies.name,
    })
    .from(companies)
    .orderBy(desc(companies.created_at_ms))
    .limit(limit)
    .all();

  const companyIds = rows.map((r) => r.id);
  const dealRows = companyIds.length
    ? db
        .select({
          company_id: deals.company_id,
          stage: deals.stage,
          value_cents: deals.value_cents,
        })
        .from(deals)
        .where(inArray(deals.company_id, companyIds))
        .orderBy(desc(deals.created_at_ms))
        .all()
    : [];

  const dealMap = new Map<string, { stage: string; value_cents: number | null }>();
  for (const d of dealRows) {
    if (d.company_id && !dealMap.has(d.company_id)) {
      dealMap.set(d.company_id, { stage: d.stage, value_cents: d.value_cents });
    }
  }

  const lines = rows.map((c) => {
    const deal = dealMap.get(c.id);
    return `• ${c.name} | ${deal ? `${deal.stage} — ${money(deal.value_cents)}` : "no active deal"}`;
  });

  return {
    result: rows.length
      ? `${rows.length} client(s):\n${lines.join("\n")}`
      : "No clients found.",
  };
}

async function getCalendarToday(): Promise<ToolResult> {
  const events = await getTodayCalendarEvents();
  if (!events.length) return { result: "Nothing on the calendar today." };

  const lines = events.map((e) => {
    const start = new Date(e.start_at_ms).toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const end = new Date(e.end_at_ms).toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const meta = e.metadata_json as Record<string, unknown> | null;
    const label = (meta?.subject as string) ?? e.booking_type.replace(/_/g, " ");
    const location = meta?.location as string | undefined;
    return `• ${start}–${end}: ${label}${location ? ` (${location})` : ""}`;
  });

  return {
    result: `${events.length} event(s) today:\n${lines.join("\n")}`,
  };
}

async function listQuotesHandler(
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(input.limit) || 15, 50);
  let query = db
    .select({
      id: quotes.id,
      quote_number: quotes.quote_number,
      status: quotes.status,
      structure: quotes.structure,
      total_cents_inc_gst: quotes.total_cents_inc_gst,
      company_id: quotes.company_id,
      created_at_ms: quotes.created_at_ms,
      sent_at_ms: quotes.sent_at_ms,
    })
    .from(quotes)
    .orderBy(desc(quotes.created_at_ms))
    .limit(limit);

  if (input.status && typeof input.status === "string") {
    query = query.where(eq(quotes.status, input.status as QuoteStatus)) as typeof query;
  }

  const rows = query.all();

  const companyIds = [...new Set(rows.map((r) => r.company_id).filter(Boolean))];
  const companyMap = new Map<string, string>();
  if (companyIds.length) {
    const companyRows = db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(inArray(companies.id, companyIds as string[]))
      .all();
    for (const c of companyRows) companyMap.set(c.id, c.name);
  }

  const lines = rows.map(
    (q) =>
      `• ${q.quote_number} | ${q.status} | ${money(q.total_cents_inc_gst)} | ${q.structure} | ${companyMap.get(q.company_id ?? "") ?? "—"} | created ${fmtDate(q.created_at_ms)}`,
  );

  return {
    result: rows.length
      ? `${rows.length} quote(s):\n${lines.join("\n")}`
      : "No quotes found.",
  };
}

async function createTaskHandler(
  input: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const title = String(input.title).trim();
  if (!title) return { result: "Task title is required." };

  let dueMs: number | null = null;
  if (typeof input.due_date === "string") {
    const parsed = new Date(input.due_date + "T00:00:00+10:00");
    if (!isNaN(parsed.getTime())) dueMs = parsed.getTime();
  }

  const task = await createTask({
    title,
    body: typeof input.body === "string" ? input.body : null,
    kind: (typeof input.kind === "string" ? input.kind : "admin") as TaskKind,
    priority: (typeof input.priority === "string"
      ? input.priority
      : "normal") as TaskPriority,
    due_at_ms: dueMs,
    created_by: userId,
  });

  return {
    result: `Task created: "${task.title}" (${task.priority} priority, ${task.kind}, ${task.due_at_ms ? `due ${fmtDate(task.due_at_ms)}` : "no due date"}).`,
  };
}

async function addExpenseHandler(
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const { createExpenseAction } = await import("@/lib/finance/actions");

  const amountDollars = Number(input.amount_dollars);
  if (!amountDollars || amountDollars <= 0) {
    return { result: "Amount must be a positive number." };
  }

  const gstDollars =
    input.gst_dollars != null ? Number(input.gst_dollars) : null;

  const result = await createExpenseAction({
    amount_inc_gst_dollars: amountDollars,
    gst_amount_dollars: gstDollars,
    category: String(input.category || "other"),
    vendor: String(input.vendor || ""),
    description: String(input.description || ""),
    expense_date:
      typeof input.expense_date === "string"
        ? input.expense_date
        : new Date().toISOString().slice(0, 10),
  });

  if (!result.ok) return { result: `Failed to add expense: ${result.error}` };

  return {
    result: `Expense added: $${amountDollars.toFixed(2)} to ${input.vendor} (${input.category}) — "${input.description}".`,
  };
}
