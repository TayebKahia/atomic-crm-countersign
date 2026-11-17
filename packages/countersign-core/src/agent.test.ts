import { describe, expect, it } from "vitest";

import {
  createScriptedModel,
  runRequest,
  type AgentEvent,
  type Caller,
  type Outcome,
  type Ports,
  type Request,
} from "./index.ts";

const REP: Caller = { userId: "user-1", salesId: 7, isAdmin: false };

const MOVE_STALE_DEALS: Request = {
  text: "Move my stale deals to proposal sent",
  source: "panel",
};

const FIXED_PLAN: Outcome = {
  kind: "plan",
  summary: "Move 1 stale deal to proposal sent",
  changes: [
    {
      kind: "update_field",
      resource: "deals",
      recordId: 12,
      field: "stage",
      from: "opportunity",
      to: "proposal-sent",
    },
  ],
  citations: [{ resource: "deals", recordId: 12 }],
};

const sequentialIds = (): (() => string) => {
  let next = 0;
  return () => `id-${++next}`;
};

const portsWith = (model: Ports["model"]): Ports => ({
  model,
  newId: sequentialIds(),
});

const collect = async (
  events: AsyncIterable<AgentEvent>,
): Promise<AgentEvent[]> => {
  const collected: AgentEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
};

describe("runRequest", () => {
  it("streams status, then the scripted Plan, then done", async () => {
    const model = createScriptedModel([
      { outcome: FIXED_PLAN, costUsd: 0.001 },
    ]);

    const events = await collect(
      runRequest(MOVE_STALE_DEALS, REP, portsWith(model)),
    );

    expect(events.map((event) => event.type)).toEqual([
      "status",
      "plan",
      "done",
    ]);
    expect(events[0]).toEqual({ type: "status", step: 1 });
    expect(events[1]).toEqual({
      type: "plan",
      planId: "id-2",
      summary: "Move 1 stale deal to proposal sent",
      changes: [
        {
          kind: "update_field",
          resource: "deals",
          recordId: 12,
          field: "stage",
          from: "opportunity",
          to: "proposal-sent",
          changeId: "id-3",
          recordLabel: "deals #12",
        },
      ],
      flagged: [],
    });
    expect(events[2]).toEqual({
      type: "done",
      requestId: "id-1",
      costUsd: 0.001,
      degraded: false,
    });
  });

  it("ends with an internal error, then done, when the outcome breaks the schema", async () => {
    const model = createScriptedModel([
      { outcome: { kind: "plan", summary: "No changes field" }, costUsd: 0 },
    ]);

    const events = await collect(
      runRequest(MOVE_STALE_DEALS, REP, portsWith(model)),
    );

    expect(events.map((event) => event.type)).toEqual([
      "status",
      "error",
      "done",
    ]);
    expect(events[1]).toMatchObject({ type: "error", code: "internal" });
  });

  it("ends with provider_unavailable, then done, when the model fails", async () => {
    const failingModel: Ports["model"] = {
      step: async () => {
        throw new Error("connection reset");
      },
    };

    const events = await collect(
      runRequest(MOVE_STALE_DEALS, REP, portsWith(failingModel)),
    );

    expect(events.map((event) => event.type)).toEqual([
      "status",
      "error",
      "done",
    ]);
    expect(events[1]).toMatchObject({
      type: "error",
      code: "provider_unavailable",
    });
    expect(events[2]).toMatchObject({ type: "done", costUsd: 0 });
  });
});
