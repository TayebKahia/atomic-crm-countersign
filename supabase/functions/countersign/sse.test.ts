// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { AgentEvent } from "@countersign/core";

import { toSseStream } from "./sse";

describe("toSseStream", () => {
  it("stops the agent and logs nothing when the caller disconnects", async () => {
    let isAgentStopped = false;
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    async function* agent(): AsyncGenerator<AgentEvent> {
      try {
        yield { type: "status", step: 1 };
        await held;
        yield { type: "status", step: 2 };
      } finally {
        isAgentStopped = true;
      }
    }
    const logged: string[] = [];
    const reader = toSseStream(agent(), (event) =>
      logged.push(event),
    ).getReader();

    await reader.read();
    await reader.cancel();
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(isAgentStopped).toBe(true);
    expect(logged).toEqual([]);
  });
});
