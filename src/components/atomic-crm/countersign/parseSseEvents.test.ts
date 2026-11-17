import type { AgentEvent } from "@countersign/core";

import { parseSseEvents } from "./parseSseEvents";

const streamOf = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
};

const collect = async (
  events: AsyncIterable<AgentEvent>,
): Promise<AgentEvent[]> => {
  const collected: AgentEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
};

const STATUS = 'event: status\ndata: {"type":"status","step":1}\n\n';
const DONE =
  'event: done\ndata: {"type":"done","requestId":"r-1","costUsd":0,"degraded":false}\n\n';

describe("parseSseEvents", () => {
  it("reads events whose frames are split across chunks", async () => {
    const wire = STATUS + DONE;
    const chunks = [wire.slice(0, 10), wire.slice(10, 47), wire.slice(47)];

    const events = await collect(parseSseEvents(streamOf(chunks)));

    expect(events).toEqual([
      { type: "status", step: 1 },
      { type: "done", requestId: "r-1", costUsd: 0, degraded: false },
    ]);
  });

  it("rejects an event that does not match the AgentEvent schema", async () => {
    const forged = 'event: done\ndata: {"type":"done","costUsd":-1}\n\n';

    await expect(collect(parseSseEvents(streamOf([forged])))).rejects.toThrow();
  });
});
