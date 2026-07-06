"use client";

import Link from "next/link";
import { FLOW_STEPS, stepIndex } from "@/lib/flow-steps";
import { cn } from "@/lib/utils";
import { useReportStore } from "@/lib/store/report-store";

export function FlowProgress({ current }: { current: string }) {
  const currentIndex = stepIndex(current);
  // Once data has been processed, every step is freely navigable (Insights,
  // Summary, and Export aren't a strict linear wizard) — only the initial
  // upload -> processing sequence is order-dependent.
  const hasProcessedData = useReportStore((s) => Boolean(s.cleaningResults.sales));

  return (
    <ol className="flex items-center gap-2 text-sm">
      {FLOW_STEPS.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isReachable = index <= currentIndex || hasProcessedData;

        return (
          <li key={step.id} className="flex items-center gap-2">
            {index > 0 && (
              <span
                className={cn(
                  "h-px w-6 shrink-0",
                  isComplete || isCurrent ? "bg-brand/60" : "bg-border"
                )}
              />
            )}
            <Link
              href={isReachable ? step.href : "#"}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors",
                isCurrent &&
                  "border-brand/40 bg-brand/10 text-brand font-medium",
                isComplete && "border-transparent text-muted-foreground",
                !isCurrent &&
                  !isComplete &&
                  "border-transparent text-muted-foreground/50",
                !isReachable && "pointer-events-none"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                  isCurrent && "bg-brand text-brand-foreground",
                  isComplete && "bg-muted-foreground/20 text-foreground",
                  !isCurrent && !isComplete && "bg-muted text-muted-foreground"
                )}
              >
                {index + 1}
              </span>
              <span className="hidden sm:inline">{step.shortLabel}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
