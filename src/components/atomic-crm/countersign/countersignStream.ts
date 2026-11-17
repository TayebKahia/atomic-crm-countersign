import type { AgentEvent } from "@countersign/core";

import { getSupabaseClient } from "../providers/supabase/supabase";
import { parseSseEvents } from "./parseSseEvents";

/** Sends one Request and yields the events the countersign function streams. */
export type StreamRequest = (
  text: string,
  signal: AbortSignal,
) => AsyncIterable<AgentEvent>;

/**
 * How long a Request may stream before the panel gives up: the Edge
 * Function's wall-clock limit (150 s), so the browser never waits longer
 * than the function can run.
 */
const REQUEST_TIMEOUT_MS = 150_000;

/** Calls the countersign Edge Function with the signed-in person's session. */
export const streamCountersignRequest: StreamRequest = async function* (
  text,
  signal,
) {
  const { data } = await getSupabaseClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("No session: sign in again");
  }
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/countersign`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ]),
    },
  );
  if (!response.ok || !response.body) {
    throw new Error(`countersign answered HTTP ${response.status}`);
  }
  yield* parseSseEvents(response.body);
};
