import { describe, it, expect } from "vitest";
import {
  OUTREACH_APPROVAL_KINDS,
} from "@/lib/db/schema/outreach-drafts";
import { AUTONOMY_MODES, autonomyState } from "@/lib/db/schema/autonomy-state";

describe("autonomy minor edit integration", () => {
  it("outreach approval kinds include minor_edit_manual and edited_manual", () => {
    expect(OUTREACH_APPROVAL_KINDS).toContain("minor_edit_manual");
    expect(OUTREACH_APPROVAL_KINDS).toContain("edited_manual");
    expect(OUTREACH_APPROVAL_KINDS).toContain("manual");
    expect(OUTREACH_APPROVAL_KINDS).toContain("auto_send");
    expect(OUTREACH_APPROVAL_KINDS).toContain("nudged_manual");
  });

  it("autonomy state schema exports graduation_threshold column", () => {
    expect(autonomyState.graduation_threshold).toBeDefined();
  });

  it("autonomy modes are unchanged", () => {
    expect(AUTONOMY_MODES).toEqual([
      "manual",
      "probation",
      "auto_send",
      "circuit_broken",
    ]);
  });
});
