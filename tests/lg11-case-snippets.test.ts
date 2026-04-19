import { describe, it, expect } from "vitest";
import {
  CASE_SNIPPET_MILESTONE_TYPES,
  CASE_SNIPPET_STATUSES,
} from "@/lib/db/schema/case-snippets";

describe("case-snippets schema", () => {
  it("exports correct milestone types", () => {
    expect(CASE_SNIPPET_MILESTONE_TYPES).toEqual([
      "shoot_completion",
      "retainer_90d",
    ]);
  });

  it("exports correct statuses", () => {
    expect(CASE_SNIPPET_STATUSES).toEqual(["pending", "approved", "rejected"]);
  });
});
