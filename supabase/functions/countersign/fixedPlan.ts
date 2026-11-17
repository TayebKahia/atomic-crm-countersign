import type { Outcome } from "@countersign/core";

/**
 * The Plan the scripted planner drafts for every Request until the real
 * planner is wired in. Nothing is saved or applied.
 */
export const FIXED_PLAN: Outcome = {
  kind: "plan",
  summary: "Move 1 stale deal to the next stage (scripted Plan)",
  changes: [
    {
      kind: "update_field",
      resource: "deals",
      recordId: 1,
      field: "stage",
      from: "opportunity",
      to: "proposal-sent",
    },
  ],
  citations: [{ resource: "deals", recordId: 1 }],
};
