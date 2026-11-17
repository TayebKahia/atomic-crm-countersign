import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createScriptedModel } from "@countersign/core";

import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { FIXED_PLAN } from "./fixedPlan.ts";
import { createCountersignHandler, type SessionLookup } from "./handler.ts";
import { logError } from "./log.ts";

/** How long the sales lookup may take before the call fails with 500. */
const SALES_LOOKUP_TIMEOUT_MS = 5_000;

// Verifies the token with Supabase Auth, then reads the CRM's sales row.
// Only the session decides who the Caller is.
const session: SessionLookup = {
  getUserId: async (token) => {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  },
  getSale: async (userId) => {
    const { data, error } = await supabaseAdmin
      .from("sales")
      .select("id, administrator, disabled")
      .eq("user_id", userId)
      .abortSignal(AbortSignal.timeout(SALES_LOOKUP_TIMEOUT_MS))
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};

Deno.serve(
  createCountersignHandler({
    session,
    createPorts: () => ({
      model: createScriptedModel([{ outcome: FIXED_PLAN, costUsd: 0 }]),
      newId: () => crypto.randomUUID(),
      logError,
    }),
  }),
);
