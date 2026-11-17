import type { Caller, Request } from "./schemas.ts";

export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelStepInput {
  caller: Caller;
  request: Request;
  messages: readonly ModelMessage[];
}

/**
 * One planner step. `outcome` is the model's raw structured output: the
 * Agent validates it, so an adapter never has to trust it. `costUsd` is
 * priced by the adapter, which knows the model and its usage.
 */
export interface ModelStepResult {
  outcome: unknown;
  costUsd: number;
}

export interface LanguageModel {
  step(input: ModelStepInput): Promise<ModelStepResult>;
}

/** Everything the Agent needs from the outside world. */
export interface Ports {
  model: LanguageModel;
  /** Returns a new unique id (Request, Plan and Change ids). */
  newId: () => string;
}
