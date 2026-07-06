"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import type { Anomaly } from "@/lib/stats/anomalies";
import { requestAnomalyExplanation } from "@/lib/ai/client";
import { useContextNotesStore } from "@/lib/store/context-notes-store";
import { DemoLimitBanner } from "@/components/demo-limit-banner";

const MAX_ROWS = 20;

function AnomalyExplainSection({ anomaly }: { anomaly: Anomaly }) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notes = useContextNotesStore((s) => s.notes);

  async function handleExplain() {
    setLoading(true);
    setError(null);
    try {
      const result = await requestAnomalyExplanation({
        metricLabel: anomaly.metricLabel,
        dimensionType: anomaly.dimensionType,
        dimensionValue: anomaly.dimensionValue,
        period: `${anomaly.periodLabel} ${anomaly.period}`,
        observed: anomaly.observed,
        baseline: anomaly.baseline,
        method: anomaly.method,
        threshold: anomaly.threshold,
        direction: anomaly.direction,
        sampleRows: anomaly.sourceRows,
        contextNotes: notes.map((n) => n.text),
      });
      setExplanation(result.explanation);
      setLimitMessage(result.limited ? (result.limitMessage ?? null) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate an explanation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {!explanation && (
        <Button variant="outline" size="sm" onClick={handleExplain} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Explain with AI
        </Button>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {limitMessage && <DemoLimitBanner message={limitMessage} />}
      {explanation && (
        <div className="rounded-lg border border-brand/20 bg-brand/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-brand">
            <Sparkles className="h-3 w-3" />
            AI explanation
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">{explanation}</p>
        </div>
      )}
    </div>
  );
}

export function AnomalyDrilldownDialog({
  anomaly,
  open,
  onOpenChange,
}: {
  anomaly: Anomaly | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const columns = anomaly?.sourceRows[0] ? Object.keys(anomaly.sourceRows[0]) : [];
  const rows = anomaly?.sourceRows.slice(0, MAX_ROWS) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {anomaly ? `${anomaly.metricLabel} — ${anomaly.dimensionValue}` : "Source rows"}
          </DialogTitle>
          <DialogDescription>
            {anomaly &&
              `${anomaly.sourceRows.length} source row${anomaly.sourceRows.length === 1 ? "" : "s"} behind this anomaly (${anomaly.periodLabel} ${anomaly.period}).`}
          </DialogDescription>
        </DialogHeader>

        {anomaly && <AnomalyExplainSection key={anomaly.id} anomaly={anomaly} />}

        <Separator />

        <div className="max-h-96 overflow-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col} className="whitespace-nowrap text-xs">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col} className="whitespace-nowrap text-xs">
                      {String(row[col] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {anomaly && anomaly.sourceRows.length > MAX_ROWS && (
          <p className="text-xs text-muted-foreground">
            Showing the first {MAX_ROWS} of {anomaly.sourceRows.length} rows.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
