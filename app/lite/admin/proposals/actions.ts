"use server";

import { auth } from "@/lib/auth/session";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  createDraftProposal,
  updateProposalSections,
  updateProposalMeta,
  getProposal,
  listProposals,
} from "@/lib/proposal-builder/draft";
import {
  defaultSection,
  PROPOSAL_TEMPLATES,
  type ProposalSection,
  type ProposalSectionType,
} from "@/lib/proposal-builder/content-shape";
import { renderProposalPdf } from "@/lib/proposal-builder/render-proposal-pdf";

const createSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  clientName: z.string().min(1),
  companyId: z.string().optional(),
  dealId: z.string().optional(),
  templateId: z.string(),
});

export async function createProposalAction(input: z.infer<typeof createSchema>) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const template = PROPOSAL_TEMPLATES.find((t) => t.id === parsed.data.templateId);
  const sectionTypes: ProposalSectionType[] = template
    ? template.sections
    : ["cover", "next_steps"];

  const sections = sectionTypes.map(defaultSection);

  if (sections[0]?.type === "cover") {
    (sections[0] as { type: "cover"; data: { title: string; subtitle: string } }).data.title =
      parsed.data.title;
    if (parsed.data.subtitle) {
      (sections[0] as { type: "cover"; data: { subtitle: string } }).data.subtitle =
        parsed.data.subtitle;
    }
  }

  const proposal = createDraftProposal({
    title: parsed.data.title,
    subtitle: parsed.data.subtitle,
    clientName: parsed.data.clientName,
    companyId: parsed.data.companyId,
    dealId: parsed.data.dealId,
    sections,
    userId: session.user.id,
  });

  revalidatePath("/lite/admin/proposals");
  return { ok: true as const, proposalId: proposal.id };
}

export async function updateSectionsAction(input: {
  proposalId: string;
  sections: ProposalSection[];
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  updateProposalSections(input.proposalId, input.sections, session.user.id);
  revalidatePath(`/lite/admin/proposals/${input.proposalId}`);
  return { ok: true as const };
}

export async function updateMetaAction(input: {
  proposalId: string;
  title?: string;
  subtitle?: string;
  clientName?: string;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  updateProposalMeta(input.proposalId, input);
  revalidatePath(`/lite/admin/proposals/${input.proposalId}`);
  return { ok: true as const };
}

export async function getProposalAction(proposalId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const proposal = getProposal(proposalId);
  if (!proposal) return { ok: false as const, error: "not_found" };
  return { ok: true as const, proposal };
}

export async function listProposalsAction() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  return { ok: true as const, proposals: listProposals() };
}

export async function downloadProposalPdfAction(proposalId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const { buffer, filename } = await renderProposalPdf(proposalId);
  const base64 = buffer.toString("base64");
  return { ok: true as const, base64, filename };
}

export async function addSectionAction(input: {
  proposalId: string;
  sectionType: ProposalSectionType;
  insertAt?: number;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const proposal = getProposal(input.proposalId);
  if (!proposal) return { ok: false as const, error: "not_found" };

  const sections = proposal.sections_json as ProposalSection[];
  const newSection = defaultSection(input.sectionType);
  const idx =
    input.insertAt !== undefined
      ? Math.min(input.insertAt, sections.length)
      : sections.length;

  sections.splice(idx, 0, newSection);
  updateProposalSections(input.proposalId, sections, session.user.id);

  revalidatePath(`/lite/admin/proposals/${input.proposalId}`);
  return { ok: true as const, sections };
}

export async function removeSectionAction(input: {
  proposalId: string;
  sectionIndex: number;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const proposal = getProposal(input.proposalId);
  if (!proposal) return { ok: false as const, error: "not_found" };

  const sections = proposal.sections_json as ProposalSection[];
  if (input.sectionIndex < 0 || input.sectionIndex >= sections.length) {
    return { ok: false as const, error: "invalid_index" };
  }

  sections.splice(input.sectionIndex, 1);
  updateProposalSections(input.proposalId, sections, session.user.id);

  revalidatePath(`/lite/admin/proposals/${input.proposalId}`);
  return { ok: true as const, sections };
}

export async function moveSectionAction(input: {
  proposalId: string;
  fromIndex: number;
  toIndex: number;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "unauthorized" };
  }

  const proposal = getProposal(input.proposalId);
  if (!proposal) return { ok: false as const, error: "not_found" };

  const sections = proposal.sections_json as ProposalSection[];
  if (
    input.fromIndex < 0 ||
    input.fromIndex >= sections.length ||
    input.toIndex < 0 ||
    input.toIndex >= sections.length
  ) {
    return { ok: false as const, error: "invalid_index" };
  }

  const [moved] = sections.splice(input.fromIndex, 1);
  sections.splice(input.toIndex, 0, moved);
  updateProposalSections(input.proposalId, sections, session.user.id);

  revalidatePath(`/lite/admin/proposals/${input.proposalId}`);
  return { ok: true as const, sections };
}
