import type { DealRow } from "@/lib/db/schema/deals";

export interface ValidateDealOk {
  ok: true;
}
export interface ValidateDealErr {
  ok: false;
  errors: string[];
}
export type ValidateDealResult = ValidateDealOk | ValidateDealErr;

export type ValidateDealInput = Pick<
  DealRow,
  "stage" | "won_outcome" | "loss_reason" | "loss_notes"
>;

/**
 * Pure finalisation guard per sales-pipeline §4.2.
 * - `won` requires `won_outcome`.
 * - `lost` requires `loss_reason`; `loss_reason === "other"` requires `loss_notes`.
 */
export function validateDeal(deal: ValidateDealInput): ValidateDealResult {
  const errors: string[] = [];
  if (deal.stage === "won" && !deal.won_outcome) {
    errors.push("won_outcome is required when stage is 'won'");
  }
  if (deal.stage === "lost") {
    if (!deal.loss_reason) {
      errors.push("loss_reason is required when stage is 'lost'");
    } else if (deal.loss_reason === "other" && !deal.loss_notes) {
      errors.push("loss_notes is required when loss_reason is 'other'");
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
