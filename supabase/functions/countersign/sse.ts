import type { AgentEvent } from "@countersign/core";

const encoder = new TextEncoder();

const frame = (event: AgentEvent): Uint8Array =>
  encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);

const isTerminal = (event: AgentEvent): boolean =>
  event.type === "done" || event.type === "error";

/**
 * Frames the Agent's events as Server-Sent Events. The stream always ends
 * with a done or error event: if the Agent throws or stops early, an internal
 * error closes it.
 */
export const toSseStream = (
  events: AsyncIterable<AgentEvent>,
  onError: (event: string, error: unknown) => void,
): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    async start(controller) {
      let last: AgentEvent | undefined;
      try {
        for await (const event of events) {
          controller.enqueue(frame(event));
          last = event;
        }
      } catch (error) {
        onError("countersign.agent_failed", error);
        last = undefined;
      }
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
  });
