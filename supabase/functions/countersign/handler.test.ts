// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { LanguageModel, Ports } from "@countersign/core";

import { createCountersignHandler, type SessionLookup } from "./handler";

const REP_TOKEN = "rep-token";
const REP_USER_ID = "user-rep";

/** A session store with one Rep (sales id 7) and one disabled account. */
const session: SessionLookup = {
  getUserId: async (token) => {
    if (token === REP_TOKEN) return REP_USER_ID;
    if (token === "disabled-token") return "user-disabled";
    return null;
  },
  getSale: async (userId) => {
    if (userId === REP_USER_ID) {
      return { id: 7, administrator: false, disabled: false };
    }
    if (userId === "user-disabled") {
      return { id: 9, administrator: false, disabled: true };
    }
    return null;
  },
};

/** Drafts a one-Change Plan whose summary names the Caller it was given. */
const callerEchoModel: LanguageModel = {
  step: async ({ caller }) => ({
    outcome: {
      kind: "plan",
      summary: `Plan for sales ${caller.salesId}, admin ${caller.isAdmin}`,
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
      citations: [],
    },
    costUsd: 0,
  }),
};

const portsWith =
  (overrides: Partial<Ports> = {}) =>
  (): Ports => {
    let next = 0;
    return {
      model: callerEchoModel,
      newId: () => `id-${++next}`,
      logError: () => {},
      ...overrides,
    };
  };

const handler = createCountersignHandler({
  session,
  createPorts: portsWith(),
});

const post = (body: unknown, token?: string) =>
  new Request("http://localhost/functions/v1/countersign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

const readEvents = async (response: Response): Promise<SseEvent[]> => {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter((frame) => frame.trim() !== "")
    .map((frame) => {
      const lines = frame.split("\n");
      const event = lines.find((line) => line.startsWith("event: "))!;
      const data = lines.find((line) => line.startsWith("data: "))!;
      return {
        event: event.slice("event: ".length),
        data: JSON.parse(data.slice("data: ".length)),
      };
    });
};

describe("countersign function", () => {
  it("rejects a call without a session with 401", async () => {
    const response = await handler(post({ text: "Move my stale deals" }));

    expect(response.status).toBe(401);
  });

  it("rejects an unknown session token with 401", async () => {
    const response = await handler(
      post({ text: "Move my stale deals" }, "forged-token"),
    );

    expect(response.status).toBe(401);
  });

  it("rejects a disabled account with 401", async () => {
    const response = await handler(
      post({ text: "Move my stale deals" }, "disabled-token"),
    );

    expect(response.status).toBe(401);
  });

  it("streams status, plan and done as server-sent events", async () => {
    const response = await handler(
      post({ text: "Move my stale deals" }, REP_TOKEN),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    const events = await readEvents(response);
    expect(events.map((event) => event.event)).toEqual([
      "status",
      "plan",
      "done",
    ]);
    expect(events[1].data).toMatchObject({
      type: "plan",
      summary: "Plan for sales 7, admin false",
    });
  });

  it("takes the Caller from the session, never from the body", async () => {
    const response = await handler(
      post(
        {
          text: "Move my stale deals",
          salesId: 1,
          isAdmin: true,
          caller: { salesId: 1, isAdmin: true },
        },
        REP_TOKEN,
      ),
    );

    const events = await readEvents(response);
    expect(events[1].data).toMatchObject({
      summary: "Plan for sales 7, admin false",
    });
  });

  it("ends the stream with an internal error when the agent fails", async () => {
    const failing = createCountersignHandler({
      session,
      createPorts: portsWith({
        newId: () => {
          throw new Error("id source down");
        },
      }),
    });

    const response = await failing(
      post({ text: "Move my stale deals" }, REP_TOKEN),
    );

    const events = await readEvents(response);
    expect(events.at(-1)).toEqual({
      event: "error",
      data: {
        type: "error",
        code: "internal",
        message: "The Request stopped unexpectedly.",
      },
    });
  });

  it("rejects an empty Request with 400", async () => {
    const response = await handler(post({ text: "   " }, REP_TOKEN));

    expect(response.status).toBe(400);
  });

  it("answers 500, without streaming, when the session cannot be read", async () => {
    const broken = createCountersignHandler({
      session: {
        ...session,
        getSale: async () => {
          throw new Error("database unreachable");
        },
      },
      createPorts: portsWith(),
    });

    const response = await broken(
      post({ text: "Move my stale deals" }, REP_TOKEN),
    );

    expect(response.status).toBe(500);
  });
});
