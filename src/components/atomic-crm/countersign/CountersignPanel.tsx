import {
  MAX_REQUEST_LENGTH,
  type AgentEvent,
  type PreviewChange,
} from "@countersign/core";
import { useTranslate, type TranslateFunction } from "ra-core";
import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import type { StreamRequest } from "./countersignStream";
import { useCountersignRequest } from "./useCountersignRequest";

export interface CountersignPanelProps {
  streamRequest: StreamRequest;
}

/** The Request box and what the agent streams back for it. */
export const CountersignPanel = ({ streamRequest }: CountersignPanelProps) => {
  const translate = useTranslate();
  const textareaId = useId();
  const [text, setText] = useState("");
  const { isRunning, step, outcome, isUnavailable, send } =
    useCountersignRequest(streamRequest);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const request = text.trim();
    if (request === "" || isRunning) return;
    void send(request);
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Label htmlFor={textareaId}>
          {translate("crm.countersign.request")}
        </Label>
        <Textarea
          id={textareaId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={translate("crm.countersign.placeholder")}
          maxLength={MAX_REQUEST_LENGTH}
        />
        <Button
          type="submit"
          className="self-end"
          disabled={isRunning || text.trim() === ""}
        >
          {translate("crm.countersign.send")}
        </Button>
      </form>
      {step !== null ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Spinner />
          {translate("crm.countersign.working", { step })}
        </p>
      ) : null}
      {isUnavailable ? (
        <p role="alert" className="text-destructive">
          {translate("crm.countersign.unavailable")}
        </p>
      ) : null}
      {outcome ? <OutcomeView event={outcome} /> : null}
    </div>
  );
};

const OutcomeView = ({ event }: { event: AgentEvent }) => {
  const translate = useTranslate();
  switch (event.type) {
    case "plan":
      return (
        <section className="flex flex-col gap-2">
          <h3 className="font-medium">{event.summary}</h3>
          <p className="text-muted-foreground">
            {translate("crm.countersign.change_count", {
              smart_count: event.changes.length,
            })}
          </p>
          <ul className="flex flex-col gap-1">
            {event.changes.map((change) => (
              <li key={change.changeId}>{describeChange(change, translate)}</li>
            ))}
          </ul>
        </section>
      );
    case "answer":
      return <p className="whitespace-pre-wrap">{event.text}</p>;
    case "refusal":
    case "error":
      return (
        <p role="alert" className="text-destructive">
          {event.message}
        </p>
      );
    default:
      return null;
  }
};

const describeChange = (
  change: PreviewChange,
  translate: TranslateFunction,
): string => {
  const describeValue = (value: unknown): string =>
    value === null || value === undefined
      ? translate("crm.countersign.empty_value")
      : String(value);
  switch (change.kind) {
    case "update_field":
      return translate("crm.countersign.change.update_field", {
        record: change.recordLabel,
        field: change.field,
        from: describeValue(change.from),
        to: describeValue(change.to),
      });
    case "create_task":
      return translate("crm.countersign.change.create_task", {
        record: change.recordLabel,
        type: change.type,
        text: change.text,
        dueDate: change.dueDate,
      });
    case "add_note":
      return translate("crm.countersign.change.add_note", {
        record: change.recordLabel,
        text: change.text,
      });
  }
};
