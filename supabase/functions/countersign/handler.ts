// The countersign Edge Function, minus the Deno wiring (index.ts): resolves
// the Caller from the session, validates the Request and streams the Agent's
// events as Server-Sent Events. Kept free of Deno globals so the functions
// test project can run it in Node.
import {
  RequestSchema,
  runRequest,
  type AgentEvent,
  type Caller,
  type Ports,
} from "@countersign/core";

import { corsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { toSseStream } from "./sse.ts";

/** The CRM's `sales` row fields the Caller is built from. */
export interface SaleIdentity {
  id: number;
  administrator: boolean;
  disabled: boolean;
}

/** How the function reads the session: auth first, then the CRM's sales row. */
export interface SessionLookup {
  /** The user id of a valid session token, or null. */
  getUserId(token: string): Promise<string | null>;
  getSale(userId: string): Promise<SaleIdentity | null>;
}

export interface CountersignDeps {
  session: SessionLookup;
  /** Fresh ports for one Request. */
  createPorts: () => Ports;
}

/** Only the Request text comes from the body; the source is fixed here. */
const RequestBodySchema = RequestSchema.pick({ text: true });

const bearerToken = (request: Request): string | null => {
  const header = request.headers.get("Authorization");
  const match = header?.match(/^Bearer (\S+)$/);
  return match ? match[1] : null;
};

/** The Caller of a valid session, or null when there is none. */
export const resolveCaller = async (
  token: string | null,
  session: SessionLookup,
): Promise<Caller | null> => {
  if (!token) return null;
  const userId = await session.getUserId(token);
  if (!userId) return null;
  const sale = await session.getSale(userId);
  if (!sale || sale.disabled) return null;
  return { userId, salesId: sale.id, isAdmin: sale.administrator };
};

export const createCountersignHandler =
  ({ session, createPorts }: CountersignDeps) =>
  async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    let caller: Caller | null;
    try {
      caller = await resolveCaller(bearerToken(request), session);
    } catch (error) {
      logError("countersign.session_lookup_failed", error);
      return createErrorResponse(500, "Could not read the session");
    }
    if (!caller) {
      return createErrorResponse(401, "Unauthorized");
    }

    const body = RequestBodySchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!body.success) {
      return createErrorResponse(400, "Invalid Request", {
        issues: body.error.issues.map((issue) => issue.message),
      });
    }

    const events: AsyncIterable<AgentEvent> = runRequest(
      { text: body.data.text, source: "panel" },
      caller,
      createPorts(),
    );
    return new Response(toSseStream(events, logError), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  };

const logError = (event: string, error: unknown): void => {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      message: error instanceof Error ? error.message : String(error),
    }),
  );
};
