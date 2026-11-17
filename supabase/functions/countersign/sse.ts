import type { AgentEvent } from "@countersign/core";

const encoder = new TextEncoder();

const frame = (event: AgentEvent): Uint8Array =>
  encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);

const isTerminal = (event: AgentEvent): boolean =>
  event.type === "done" || event.type === "error";

/**
 * Frames the Agent's events as Server-Sent Events. The stream always ends
 * with a done or error event: if the Agent throws or stops early, an internal
 * error closes it. If the caller disconnects, the Agent is stopped.
 */
export const toSseStream = (
  events: AsyncIterable<AgentEvent>,
  onError: (event: string, error: unknown) => void,
): ReadableStream<Uint8Array> => {
  const iterator = events[Symbol.asyncIterator]();
  let isCancelled = false;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let last: AgentEvent | undefined;
      try {
        while (!isCancelled) {
          const next = await iterator.next();
          if (next.done || isCancelled) break;
          controller.enqueue(frame(next.value));
          last = next.value;
        }
      } catch (error) {
        if (isCancelled) return;
        onError("countersign.agent_failed", error);
        last = undefined;
      }
      if (isCancelled) return;
      if (!last || !isTerminal(last)) {
        controller.enqueue(
          frame({
            type: "error",
            code: "internal",
            message: "The Request stopped unexpectedly.",
          }),
        );
      }
      controller.close();
    },
    cancel() {
      isCancelled = true;
      // Not awaited: the Agent finishes its current step, then stops.
      iterator.return?.().catch((error: unknown) => {
        onError("countersign.agent_stop_failed", error);
      });
    },
  });
};
