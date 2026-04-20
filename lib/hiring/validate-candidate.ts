import type { CandidateRow } from "@/lib/db/schema/candidates";

export interface ValidateCandidateOk {
  ok: true;
}
export interface ValidateCandidateErr {
  ok: false;
  errors: string[];
}
export type ValidateCandidateResult =
  | ValidateCandidateOk
  | ValidateCandidateErr;

export type ValidateCandidateInput = Pick<
  CandidateRow,
  | "stage"
  | "bench_status"
  | "paused_until_ms"
  | "abn"
  | "agreement_signed_at_ms"
  | "bank_details"
  | "hourly_rate_aud"
  | "weekly_capacity_hours"
>;

export function validateCandidate(
  candidate: ValidateCandidateInput,
): ValidateCandidateResult {
  const errors: string[] = [];

  if (candidate.stage === "bench") {
    if (!candidate.abn) {
      errors.push("abn is required for bench stage");
    }
    if (!candidate.agreement_signed_at_ms) {
      errors.push("agreement_signed_at_ms is required for bench stage");
    }
    if (!candidate.bank_details) {
      errors.push("bank_details is required for bench stage");
    }
    if (!candidate.hourly_rate_aud) {
      errors.push("hourly_rate_aud is required for bench stage");
    }
    if (
      candidate.weekly_capacity_hours == null ||
      candidate.weekly_capacity_hours <= 0
    ) {
      errors.push(
        "weekly_capacity_hours must be > 0 for bench stage",
      );
    }
  }

  if (
    candidate.paused_until_ms != null &&
    candidate.bench_status !== "paused"
  ) {
    errors.push(
      "paused_until_ms can only be set when bench_status is 'paused'",
    );
  }

  if (
    candidate.bench_status != null &&
    candidate.stage !== "bench"
  ) {
    errors.push("bench_status can only be set when stage is 'bench'");
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
