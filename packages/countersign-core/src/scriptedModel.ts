import type { LanguageModel, ModelStepResult } from "./ports.ts";

/**
 * A LanguageModel that replays fixed step results in order. It drives the
 * Agent in tests and stands in for the real planner until one is wired in.
 * Asking for more steps than were scripted is an error.
 */
export const createScriptedModel = (
  script: readonly ModelStepResult[],
): LanguageModel => {
  let position = 0;
  return {
    step: async () => {
      const next = script[position];
      if (next === undefined) {
        throw new Error(
          `Scripted model has no step ${position + 1} (script has ${script.length})`,
        );
      }
      position += 1;
      return next;
    },
  };
};
