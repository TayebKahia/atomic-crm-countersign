import type { AgentEvent } from "@countersign/core";
import { useCallback, useEffect, useReducer, useRef } from "react";

import type { StreamRequest } from "./countersignStream";

type OutcomeEvent = Extract<
  AgentEvent,
  { type: "plan" | "answer" | "refusal" | "error" }
>;

export interface CountersignRequestState {
  isRunning: boolean;
  /** The planner step in progress, while running. */
  step: number | null;
  outcome: OutcomeEvent | null;
  /** True when the function could not be reached or its stream broke. */
  isUnavailable: boolean;
}

const INITIAL_STATE: CountersignRequestState = {
  isRunning: false,
  step: null,
  outcome: null,
  isUnavailable: false,
};

type Action =
  | { type: "start" }
  | { type: "event"; event: AgentEvent }
  | { type: "finish" }
  | { type: "fail" };

const reducer = (
  state: CountersignRequestState,
  action: Action,
): CountersignRequestState => {
  switch (action.type) {
    case "start":
      return { ...INITIAL_STATE, isRunning: true };
    case "event": {
      const { event } = action;
      if (event.type === "status") return { ...state, step: event.step };
      if (event.type === "done") return state;
      return { ...state, step: null, outcome: event };
    }
    case "finish":
      // A stream that closes without an outcome is a broken stream.
      return {
        ...state,
        isRunning: false,
        step: null,
        isUnavailable: state.outcome === null,
      };
    case "fail":
      return { ...state, isRunning: false, step: null, isUnavailable: true };
  }
};

export interface CountersignRequest extends CountersignRequestState {
  send: (text: string) => Promise<void>;
}

/** Runs Requests one at a time and folds their streamed events into state. */
export const useCountersignRequest = (
  streamRequest: StreamRequest,
): CountersignRequest => {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      dispatch({ type: "start" });
      try {
        for await (const event of streamRequest(text, controller.signal)) {
          if (controller.signal.aborted) return;
          dispatch({ type: "event", event });
        }
        dispatch({ type: "finish" });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Countersign Request failed", error);
        dispatch({ type: "fail" });
      }
    },
    [streamRequest],
  );

  return { ...state, send };
};
