"use client";

import type { LotEvent } from "@/lib/types";
import { lotEventLabel } from "@/lib/lots";
import { formatDateTime, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

function eventAccent(type: string): string {
  if (type === "VOIDED" || type === "QC_HELD") return "bg-[var(--csolve-cherry)]";
  if (type === "QC_RELEASED" || type === "PROCESS_COMPLETED")
    return "bg-[var(--csolve-leaf)]";
  if (type === "CREATED" || type === "COLLECTED")
    return "bg-[var(--csolve-roast)]";
  return "bg-[var(--csolve-bean)]";
}

export function LotTimeline({ events }: { events: LotEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-[var(--csolve-text-muted)]">
        No events recorded yet.
      </p>
    );
  }

  return (
    <ol className="relative space-y-0 px-4 py-4">
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        return (
          <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast ? (
              <span
                className="absolute top-3 left-[11px] h-[calc(100%-4px)] w-px bg-[var(--csolve-border)]"
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 mt-1 size-[22px] shrink-0 rounded-full ring-4 ring-[var(--csolve-parchment)]",
                eventAccent(event.eventType)
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1 rounded-lg border border-[var(--csolve-border)] bg-[var(--csolve-section)]/40 px-3 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--csolve-text)]">
                  {lotEventLabel(event.eventType)}
                </p>
                <time className="text-[11px] tabular-nums text-[var(--csolve-text-muted)]">
                  {formatDateTime(event.createdAt)}
                </time>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--csolve-text-muted)]">
                {event.quantity ? (
                  <span>{formatQty(event.quantity)} kg</span>
                ) : null}
                {event.fromLocation || event.toLocation ? (
                  <span>
                    {event.fromLocation?.name ?? "—"}
                    {" → "}
                    {event.toLocation?.name ?? "—"}
                  </span>
                ) : null}
                {event.relatedLot?.code ? (
                  <span>Related: {event.relatedLot.code}</span>
                ) : null}
                {event.createdBy?.fullName ? (
                  <span>by {event.createdBy.fullName}</span>
                ) : null}
              </div>
              {event.notes ? (
                <p className="mt-1.5 text-sm text-[var(--csolve-text)]">
                  {event.notes}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
