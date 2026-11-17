import type { AgentEvent } from "@countersign/core";

import { getSupabaseClient } from "../providers/supabase/supabase";
import { parseSseEvents } from "./parseSseEvents";

/** Sends one Request and yields the events the countersign function streams. */
export type StreamRequest = (
  text: string,
  signal: AbortSignal,
) => AsyncIterable<AgentEvent>;

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
      signal,
    },
  );
  if (!response.ok || !response.body) {
    throw new Error(`countersign answered HTTP ${response.status}`);
  }
  yield* parseSseEvents(response.body);
};
