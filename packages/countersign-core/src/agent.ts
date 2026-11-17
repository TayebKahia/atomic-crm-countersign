import type { ModelStepResult, Ports } from "./ports.ts";
import { OutcomeSchema } from "./schemas.ts";
import type {
  AgentEvent,
  Caller,
  Change,
  Outcome,
  PreviewChange,
  Request,
} from "./schemas.ts";

/**
 * Runs one Request for one Caller and streams its AgentEvents: status, then
 * the outcome, then done.
 */
export async function* runRequest(
  request: Request,
  caller: Caller,
  ports: Ports,
): AsyncGenerator<AgentEvent> {
  const requestId = ports.newId();
  yield { type: "status", step: 1 };
  const { event, costUsd } = await planStep(request, caller, ports);
  yield event;
  yield { type: "done", requestId, costUsd, degraded: false };
}

/** One planner step, turned into the Request's outcome event. Never throws. */
const planStep = async (
  request: Request,
  caller: Caller,
  ports: Ports,
): Promise<{ event: AgentEvent; costUsd: number }> => {
  let result: ModelStepResult;
  try {
    result = await ports.model.step({
      caller,
      request,
      messages: [{ role: "user", content: request.text }],
    });
  } catch {
    return {
      event: {
        type: "error",
        code: "provider_unavailable",
        message: "The language model could not be reached. Try again later.",
      },
      costUsd: 0,
    };
  }
  const parsed = OutcomeSchema.safeParse(result.outcome);
  const event: AgentEvent = parsed.success
    ? toOutcomeEvent(parsed.data, ports)
    : {
        type: "error",
        code: "internal",
        message: "The planner returned an outcome that is not valid.",
      };
  return { event, costUsd: result.costUsd };
};

const toOutcomeEvent = (outcome: Outcome, ports: Ports): AgentEvent => {
  switch (outcome.kind) {
    case "plan":
      return {
        type: "plan",
        planId: ports.newId(),
        summary: outcome.summary,
        changes: outcome.changes.map((change): PreviewChange => ({
          ...change,
          changeId: ports.newId(),
          recordLabel: recordLabelOf(change),
        })),
        flagged: [],
      };
    case "answer":
      return {
        type: "answer",
        text: outcome.text,
        citations: outcome.citations,
        flagged: [],
      };
    case "refusal":
      return {
        type: "refusal",
        reason: outcome.reason,
        message: outcome.message,
      };
  }
};

/** A placeholder label until Records are read through the CrmReader. */
const recordLabelOf = (change: Change): string => {
  switch (change.kind) {
    case "update_field":
      return `${change.resource} #${change.recordId}`;
    case "create_task":
      return `contacts #${change.contactId}`;
    case "add_note":
      return `${change.target.resource} #${change.target.recordId}`;
  }
};
