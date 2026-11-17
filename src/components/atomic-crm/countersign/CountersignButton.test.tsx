import type { AgentEvent } from "@countersign/core";
import { I18nContextProvider } from "ra-core";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import { testI18nProvider } from "../providers/commons/i18nProvider";
import { CountersignButton } from "./CountersignButton";
import type { StreamRequest } from "./countersignStream";

const PLAN_EVENT: AgentEvent = {
  type: "plan",
  planId: "plan-1",
  summary: "Move 1 stale deal to proposal sent",
  changes: [
    {
      kind: "update_field",
      resource: "deals",
      recordId: 12,
      field: "stage",
      from: "opportunity",
      to: "proposal-sent",
      changeId: "change-1",
      recordLabel: "deals #12",
    },
  ],
  flagged: [],
};

const DONE_EVENT: AgentEvent = {
  type: "done",
  requestId: "request-1",
  costUsd: 0,
  degraded: false,
};

/**
 * A fake event stream: emits status, then holds until `release` is called,
 * then emits the given events. Lets the test see the in-progress state.
 */
const heldStream = (rest: AgentEvent[]) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requests: string[] = [];
  const stream: StreamRequest = async function* (text) {
    requests.push(text);
    yield { type: "status", step: 1 };
    await held;
    yield* rest;
  };
  return { stream, release, requests };
};

const renderButton = (streamRequest: StreamRequest) =>
  render(
    <I18nContextProvider value={testI18nProvider}>
      <CountersignButton streamRequest={streamRequest} />
    </I18nContextProvider>,
  );

describe("CountersignButton", () => {
  it("opens the panel, sends the Request and shows the streamed Plan", async () => {
    const { stream, release, requests } = heldStream([PLAN_EVENT, DONE_EVENT]);
    const screen = await renderButton(stream);

    await screen.getByRole("button", { name: "Countersign" }).click();
    await expect
      .element(screen.getByRole("dialog", { name: "Countersign" }))
      .toBeVisible();
    await userEvent.fill(
      screen.getByRole("textbox", { name: "Request" }),
      "Move my stale deals to proposal sent",
    );
    await screen.getByRole("button", { name: "Send" }).click();

    await expect.element(screen.getByText("Working: step 1")).toBeVisible();
    release();
    await expect
      .element(screen.getByText("Move 1 stale deal to proposal sent"))
      .toBeVisible();
    await expect
      .element(screen.getByText("deals #12: stage opportunity → proposal-sent"))
      .toBeVisible();
    await expect
      .element(screen.getByText("Working: step 1"))
      .not.toBeInTheDocument();
    expect(requests).toEqual(["Move my stale deals to proposal sent"]);
  });

  it("shows the error message when the Request ends with an error", async () => {
    const { stream, release } = heldStream([
      {
        type: "error",
        code: "provider_unavailable",
        message: "The language model could not be reached. Try again later.",
      },
      DONE_EVENT,
    ]);
    release();
    const screen = await renderButton(stream);

    await screen.getByRole("button", { name: "Countersign" }).click();
    await userEvent.fill(
      screen.getByRole("textbox", { name: "Request" }),
      "Summarise Acme",
    );
    await screen.getByRole("button", { name: "Send" }).click();

    await expect
      .element(
        screen.getByText(
          "The language model could not be reached. Try again later.",
        ),
      )
      .toBeVisible();
  });

  it("tells the person when Countersign cannot be reached", async () => {
    const unreachable: StreamRequest = () => ({
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.reject(new Error("HTTP 503")),
      }),
    });
    const screen = await renderButton(unreachable);

    await screen.getByRole("button", { name: "Countersign" }).click();
    await userEvent.fill(
      screen.getByRole("textbox", { name: "Request" }),
      "Summarise Acme",
    );
    await screen.getByRole("button", { name: "Send" }).click();

    await expect
      .element(
        screen.getByText("Countersign is unavailable right now. Try again."),
      )
      .toBeVisible();
  });
});
