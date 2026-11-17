import { AgentEventSchema, type AgentEvent } from "@countersign/core";

const FRAME_SEPARATOR = "\n\n";
const DATA_PREFIX = "data: ";

const parseFrame = (frame: string): AgentEvent | null => {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith(DATA_PREFIX))
    .map((line) => line.slice(DATA_PREFIX.length))
    .join("\n");
  if (data === "") return null;
  return AgentEventSchema.parse(JSON.parse(data));
};

/**
 * Reads the countersign function's Server-Sent Events. Frames may arrive
 * split across chunks; each event is validated against the AgentEvent schema
 * and a malformed one throws.
 */
export async function* parseSseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentEvent> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let separator = buffer.indexOf(FRAME_SEPARATOR);
      while (separator !== -1) {
        const event = parseFrame(buffer.slice(0, separator));
        buffer = buffer.slice(separator + FRAME_SEPARATOR.length);
        if (event) yield event;
        separator = buffer.indexOf(FRAME_SEPARATOR);
      }
    }
    const last = parseFrame(buffer);
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}
