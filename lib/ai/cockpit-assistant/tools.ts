import type Anthropic from "@anthropic-ai/sdk";

export const COCKPIT_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_deals",
    description:
      "List pipeline deals. Optionally filter by stage. Returns deal title, stage, value, company name, and last activity.",
    input_schema: {
      type: "object" as const,
      properties: {
        stage: {
          type: "string",
          enum: [
            "lead",
            "contacted",
            "conversation",
            "trial_shoot",
            "quoted",
            "negotiating",
            "won",
            "lost",
          ],
          description: "Filter by pipeline stage. Omit to return all stages.",
        },
        limit: {
          type: "number",
          description: "Max results to return. Default 20.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_deal_details",
    description:
      "Get full details for a specific deal — contacts, quotes, value, stage, notes.",
    input_schema: {
      type: "object" as const,
      properties: {
        deal_id: { type: "string", description: "The deal ID." },
      },
      required: ["deal_id"],
    },
  },
  {
    name: "list_tasks",
    description:
      "List tasks/to-do items. Filter by status and/or priority.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "todo",
              "in_progress",
              "blocked",
              "awaiting_approval",
              "delivered",
              "done",
              "cancelled",
            ],
          },
          description:
            'Filter by status. Omit to return open tasks (todo, in_progress, blocked).',
        },
        priority: {
          type: "string",
          enum: ["high", "normal", "low"],
          description: "Filter by priority.",
        },
        limit: { type: "number", description: "Max results. Default 20." },
      },
      required: [],
    },
  },
  {
    name: "get_finance_summary",
    description:
      "Get a P&L summary for a given period — revenue, expenses, net, tax provision.",
    input_schema: {
      type: "object" as const,
      properties: {
        period: {
          type: "string",
          enum: [
            "this_month",
            "last_month",
            "this_quarter",
            "last_quarter",
            "this_fy",
            "last_fy",
          ],
          description: "The time period. Default this_month.",
        },
      },
      required: [],
    },
  },
  {
    name: "list_recent_expenses",
    description: "List recent expenses with amount, vendor, category, and date.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max results. Default 15." },
      },
      required: [],
    },
  },
  {
    name: "list_clients",
    description: "List companies/clients with their current deal stage and value.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max results. Default 20." },
      },
      required: [],
    },
  },
  {
    name: "get_calendar_today",
    description: "Get today's calendar events — meetings, shoots, deadlines.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_quotes",
    description:
      "List quotes, optionally filtered by status. Returns quote number, status, total, company, and dates.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: [
            "draft",
            "sent",
            "viewed",
            "accepted",
            "superseded",
            "withdrawn",
            "expired",
          ],
          description: "Filter by status. Omit to return all.",
        },
        limit: { type: "number", description: "Max results. Default 15." },
      },
      required: [],
    },
  },
  {
    name: "create_task",
    description:
      "Create a new task/to-do item. Returns the created task.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Task title." },
        body: { type: "string", description: "Optional details/notes." },
        kind: {
          type: "string",
          enum: [
            "personal",
            "admin",
            "prospect_followup",
            "client_deliverable",
            "client_task",
          ],
          description: 'Task kind. Default "admin".',
        },
        priority: {
          type: "string",
          enum: ["high", "normal", "low"],
          description: 'Priority. Default "normal".',
        },
        due_date: {
          type: "string",
          description: "Due date as YYYY-MM-DD. Optional.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "add_expense",
    description: "Record a new expense. Returns confirmation.",
    input_schema: {
      type: "object" as const,
      properties: {
        amount_dollars: {
          type: "number",
          description: "Amount in AUD dollars (inc GST).",
        },
        gst_dollars: {
          type: "number",
          description: "GST component in AUD dollars. Null if GST-free.",
        },
        category: {
          type: "string",
          enum: [
            "software_subscriptions",
            "api_costs",
            "payment_processing",
            "ads",
            "contractors",
            "equipment",
            "travel",
            "accountant_legal",
            "other",
          ],
          description: "Expense category.",
        },
        vendor: { type: "string", description: "Vendor/supplier name." },
        description: { type: "string", description: "What the expense is for." },
        expense_date: {
          type: "string",
          description: "Date as YYYY-MM-DD. Defaults to today.",
        },
      },
      required: ["amount_dollars", "category", "vendor", "description"],
    },
  },
];
