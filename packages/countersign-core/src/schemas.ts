import { z } from "zod";

/** The longest Request a person may type, in characters. */
export const MAX_REQUEST_LENGTH = 2000;

/**
 * Who is asking. Resolved by the Edge Function from the caller's session,
 * never read from the Request body.
 */
export const CallerSchema = z.object({
  userId: z.string().min(1),
  salesId: z.number().int().positive(),
  isAdmin: z.boolean(),
});
export type Caller = z.infer<typeof CallerSchema>;

/** What a person asks Countersign to do, in their own words, in one turn. */
export const RequestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_REQUEST_LENGTH),
  source: z.enum(["panel", "mcp"]),
});
export type Request = z.infer<typeof RequestSchema>;

export const RecordRefSchema = z.object({
  resource: z.string().min(1),
  recordId: z.number().int(),
});
export type RecordRef = z.infer<typeof RecordRefSchema>;

/** One proposed write to one Record. These are the only writes that exist. */
export const ChangeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("update_field"),
    resource: z.enum(["deals", "contacts", "companies", "tasks"]),
    recordId: z.number().int(),
    field: z.string().min(1),
    from: z.unknown(),
    to: z.unknown(),
  }),
  z.object({
    kind: z.literal("create_task"),
    contactId: z.number().int(),
    type: z.string().min(1),
    text: z.string().min(1),
    dueDate: z.string().min(1),
  }),
  z.object({
    kind: z.literal("add_note"),
    target: z.object({
      resource: z.enum(["contacts", "deals"]),
      recordId: z.number().int(),
    }),
    text: z.string().min(1),
  }),
]);
export type Change = z.infer<typeof ChangeSchema>;

/** The planner's structured outcome for one Request. */
export const OutcomeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("plan"),
    summary: z.string().min(1),
    changes: z.array(ChangeSchema),
    citations: z.array(RecordRefSchema),
  }),
  z.object({
    kind: z.literal("answer"),
    text: z.string().min(1),
    citations: z.array(RecordRefSchema),
  }),
  z.object({
    kind: z.literal("refusal"),
    reason: z.enum(["out_of_scope", "policy", "ambiguous", "not_found"]),
    message: z.string().min(1),
  }),
]);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const PreviewChangeSchema = z.intersection(
  ChangeSchema,
  z.object({ changeId: z.string().min(1), recordLabel: z.string() }),
);
export type PreviewChange = z.infer<typeof PreviewChangeSchema>;

export const FlaggedTextSchema = z.object({
  resource: z.string(),
  recordId: z.number().int(),
  field: z.string(),
  source: z.enum(["detector", "second_opinion", "degraded"]),
});
export type FlaggedText = z.infer<typeof FlaggedTextSchema>;

export const ERROR_CODES = [
  "budget_exhausted",
  "rate_limited",
  "spend_limit",
  "provider_unavailable",
  "internal",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * The events of one Request, in order: status* (progress), then one of plan,
 * answer, refusal or error, then done.
 */
export const AgentEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("status"),
    step: z.number().int().positive(),
    tool: z.string().optional(),
  }),
  z.object({
    type: z.literal("plan"),
    planId: z.string().min(1),
    summary: z.string(),
    changes: z.array(PreviewChangeSchema),
    flagged: z.array(FlaggedTextSchema),
  }),
  z.object({
    type: z.literal("answer"),
    text: z.string(),
    citations: z.array(RecordRefSchema),
    flagged: z.array(FlaggedTextSchema),
  }),
  z.object({
    type: z.literal("refusal"),
    reason: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("error"),
    code: z.enum(ERROR_CODES),
    message: z.string(),
  }),
  z.object({
    type: z.literal("done"),
    requestId: z.string().min(1),
    costUsd: z.number().nonnegative(),
    degraded: z.boolean(),
  }),
]);
export type AgentEvent = z.infer<typeof AgentEventSchema>;
