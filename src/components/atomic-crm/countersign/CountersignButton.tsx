import { PenLine } from "lucide-react";
import { useTranslate } from "ra-core";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  streamCountersignRequest,
  type StreamRequest,
} from "./countersignStream";
import { CountersignPanel } from "./CountersignPanel";

export interface CountersignButtonProps {
  /** Where Requests go. Defaults to the countersign Edge Function. */
  streamRequest?: StreamRequest;
}

/** Opens the Countersign panel as a side sheet from the CRM's app bar. */
export const CountersignButton = ({
  streamRequest = streamCountersignRequest,
}: CountersignButtonProps) => {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);
  const title = translate("crm.countersign.title");

  return (
    <>
      <Button
        variant="ghost"
        className="text-secondary-foreground"
        onClick={() => setOpen(true)}
      >
        <PenLine />
        {title}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>
              {translate("crm.countersign.description")}
            </SheetDescription>
          </SheetHeader>
          <CountersignPanel streamRequest={streamRequest} />
        </SheetContent>
      </Sheet>
    </>
  );
};
