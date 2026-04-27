/**
 * Proposal PDF rendering — orchestrates HTML build + Puppeteer render.
 */

import { getProposal } from "./draft";
import { buildProposalPdfHtml, proposalFilename } from "./pdf-template";
import { renderToPdf } from "@/lib/pdf/render";
import type { ProposalSection } from "./content-shape";

export async function renderProposalPdf(proposalId: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const proposal = getProposal(proposalId);
  if (!proposal) throw new Error("Proposal not found");

  const sections = proposal.sections_json as ProposalSection[];
  const html = buildProposalPdfHtml(proposal, sections);

  const buffer = await renderToPdf(html, {
    format: "A4",
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    printBackground: true,
  });

  return {
    buffer,
    filename: proposalFilename(proposal.client_name, proposal.proposal_number),
  };
}
