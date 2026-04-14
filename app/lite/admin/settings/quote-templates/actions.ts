"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import {
  createQuoteTemplate,
  updateQuoteTemplate,
  softDeleteQuoteTemplate,
  TemplateValidationError,
  type QuoteTemplateInput,
} from "@/lib/quote-builder/templates";
import {
  QUOTE_TEMPLATE_STRUCTURES,
  type QuoteTemplateStructure,
} from "@/lib/db/schema/quote-templates";

type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requireAdmin(): Promise<boolean> {
  const session = await auth();
  return !!session?.user && session.user.role === "admin";
}

type RawInput = {
  name: string;
  structure: string;
  term_length_months: number | null;
  default_sections: QuoteTemplateInput["default_sections"];
  default_line_items: QuoteTemplateInput["default_line_items"];
};

function coerce(raw: RawInput): QuoteTemplateInput | { error: string } {
  if (!QUOTE_TEMPLATE_STRUCTURES.includes(raw.structure as QuoteTemplateStructure)) {
    return { error: "Unknown structure." };
  }
  return {
    name: raw.name,
    structure: raw.structure as QuoteTemplateStructure,
    term_length_months: raw.term_length_months,
    default_sections: raw.default_sections ?? {},
    default_line_items: raw.default_line_items ?? [],
  };
}

function revalidate() {
  revalidatePath("/lite/admin/settings/quote-templates");
}

export async function createQuoteTemplateAction(
  raw: RawInput,
): Promise<ActionResult<{ id: string }>> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };
  const parsed = coerce(raw);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  try {
    const row = createQuoteTemplate(parsed);
    revalidate();
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof TemplateValidationError
          ? err.message
          : "Could not create template.",
    };
  }
}

export async function updateQuoteTemplateAction(
  id: string,
  raw: RawInput,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };
  const parsed = coerce(raw);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  try {
    updateQuoteTemplate(id, parsed);
    revalidate();
    return { ok: true, data: null };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof TemplateValidationError
          ? err.message
          : "Could not update template.",
    };
  }
}

export async function softDeleteQuoteTemplateAction(
  id: string,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };
  try {
    softDeleteQuoteTemplate(id);
    revalidate();
    return { ok: true, data: null };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof TemplateValidationError
          ? err.message
          : "Could not delete template.",
    };
  }
}
