"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FlowProgress } from "@/components/flow-progress";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  LoaderCircle,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { cn, sleep } from "@/lib/utils";
import { useReportStore, type DatasetKey } from "@/lib/store/report-store";
import { DATASET_SCHEMAS, mapColumns, type ColumnMapping } from "@/lib/data/schema";
import { parseFile, type ParsedFile } from "@/lib/data/parse-file";
import { dedupeRows, buildCanonicalRows, type CleaningResult } from "@/lib/data/clean-dataset";
import { crossReferenceDatasets, type CrossReferenceCheck } from "@/lib/data/cross-reference";
import { ColumnMappingReview, type MappingReviewDataset } from "@/components/processing/column-mapping-review";

type StepId = "parse" | "duplicates" | "review" | "nulls" | "crossref";

const STEP_LABELS: Record<StepId, string> = {
  parse: "Parsing uploaded files",
  duplicates: "Removing duplicates",
  review: "Reviewing column mapping",
  nulls: "Handling missing & mismatched values",
  crossref: "Cross-referencing datasets",
};

const STEP_ORDER: StepId[] = ["parse", "duplicates", "review", "nulls", "crossref"];
const MIN_STEP_MS = 550;

const DATASET_LABELS: Record<DatasetKey, string> = {
  sales: "Sales",
  orders: "Orders",
  inventory: "Inventory",
  returns: "Returns",
};

export default function ProcessingPage() {
  const router = useRouter();
  const files = useReportStore((s) => s.files);
  const setCleaningResults = useReportStore((s) => s.setCleaningResults);
  const setStatus = useReportStore((s) => s.setStatus);

  const [completed, setCompleted] = useState<Set<StepId>>(new Set());
  const [stepDetail, setStepDetail] = useState<Partial<Record<StepId, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [crossRefChecks, setCrossRefChecks] = useState<CrossReferenceCheck[]>([]);
  const [results, setResults] = useState<Partial<Record<DatasetKey, CleaningResult>>>({});
  const [reviewDatasets, setReviewDatasets] = useState<MappingReviewDataset[] | null>(null);
  const hasRun = useRef(false);

  const parsedByKeyRef = useRef<Partial<Record<DatasetKey, ParsedFile>>>({});
  const dedupedByKeyRef = useRef<Partial<Record<DatasetKey, Record<string, string>[]>>>({});
  const presentKeysRef = useRef<DatasetKey[]>([]);

  async function runStep(id: StepId, work: () => Promise<string>) {
    const [detail] = await Promise.all([work(), sleep(MIN_STEP_MS)]);
    setStepDetail((prev) => ({ ...prev, [id]: detail }));
    setCompleted((prev) => new Set(prev).add(id));
  }

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!files.sales) {
      router.replace("/upload");
      return;
    }

    const presentKeys = (Object.keys(files) as DatasetKey[]).filter((k) => files[k]);
    presentKeysRef.current = presentKeys;

    async function run() {
      setStatus("processing");
      try {
        await runStep("parse", async () => {
          for (const key of presentKeys) {
            parsedByKeyRef.current[key] = await parseFile(files[key]!);
          }
          const rowCount = presentKeys.reduce(
            (sum, key) => sum + (parsedByKeyRef.current[key]?.rows.length ?? 0),
            0
          );
          return `Read ${rowCount.toLocaleString()} rows across ${presentKeys.length} file${presentKeys.length === 1 ? "" : "s"}.`;
        });

        await runStep("duplicates", async () => {
          let removed = 0;
          for (const key of presentKeys) {
            const { rows, duplicatesRemoved } = dedupeRows(parsedByKeyRef.current[key]!.rows);
            dedupedByKeyRef.current[key] = rows;
            removed += duplicatesRemoved;
          }
          return removed === 0
            ? "No duplicate rows found."
            : `Removed ${removed.toLocaleString()} duplicate row${removed === 1 ? "" : "s"}.`;
        });

        // Compute the initial auto-detected mapping, then pause here and let
        // the user review/correct it before we build canonical rows.
        const datasetsForReview: MappingReviewDataset[] = presentKeys.map((key) => {
          const schema = DATASET_SCHEMAS[key];
          const mapping = mapColumns(schema, parsedByKeyRef.current[key]!.headers);
          return {
            key,
            schema,
            headers: parsedByKeyRef.current[key]!.headers,
            fieldToHeader: mapping.fieldToHeader,
            matchType: mapping.matchType,
            sampleRows: dedupedByKeyRef.current[key]!.slice(0, 200),
          };
        });
        setReviewDatasets(datasetsForReview);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong while processing your files.";
        setError(message);
        setStatus("error", message);
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConfirmMapping(overrides: Partial<Record<DatasetKey, Record<string, string | null>>>) {
    setCompleted((prev) => new Set(prev).add("review"));
    const presentKeys = presentKeysRef.current;

    const manualCount = reviewDatasets
      ? reviewDatasets.reduce((sum, d) => {
          return (
            sum +
            d.schema.fields.filter((f) => overrides[d.key]?.[f.key] !== d.fieldToHeader[f.key]).length
          );
        }, 0)
      : 0;
    setStepDetail((prev) => ({
      ...prev,
      review:
        manualCount === 0
          ? "Auto-detected mapping confirmed as-is."
          : `Confirmed, with ${manualCount} field${manualCount === 1 ? "" : "s"} adjusted manually.`,
    }));

    try {
      const finalMappingByKey: Partial<Record<DatasetKey, ColumnMapping>> = {};
      for (const key of presentKeys) {
        finalMappingByKey[key] = mapColumns(
          DATASET_SCHEMAS[key],
          parsedByKeyRef.current[key]!.headers,
          overrides[key] ?? {}
        );
      }

      const cleaningResults: Partial<Record<DatasetKey, CleaningResult>> = {};
      await runStep("nulls", async () => {
        let nulls = 0;
        let dropped = 0;
        let mismatches = 0;
        for (const key of presentKeys) {
          const schema = DATASET_SCHEMAS[key];
          const mapping = finalMappingByKey[key]!;
          const built = buildCanonicalRows(schema, mapping, dedupedByKeyRef.current[key]!);
          nulls += built.nullsHandled;
          dropped += built.rowsDroppedMissingRequired;
          mismatches += built.typeMismatchesCoerced;

          cleaningResults[key] = {
            datasetType: key,
            mapping,
            rows: built.rows,
            counts: {
              totalRawRows: parsedByKeyRef.current[key]!.rows.length,
              duplicatesRemoved: parsedByKeyRef.current[key]!.rows.length - dedupedByKeyRef.current[key]!.length,
              nullsHandled: built.nullsHandled,
              rowsDroppedMissingRequired: built.rowsDroppedMissingRequired,
              typeMismatchesCoerced: built.typeMismatchesCoerced,
              cleanRowCount: built.rows.length,
            },
          };
        }
        setResults(cleaningResults);
        const parts: string[] = [];
        if (nulls > 0) parts.push(`filled ${nulls.toLocaleString()} missing value${nulls === 1 ? "" : "s"}`);
        if (mismatches > 0) parts.push(`coerced ${mismatches.toLocaleString()} type mismatch${mismatches === 1 ? "" : "es"}`);
        if (dropped > 0) parts.push(`dropped ${dropped.toLocaleString()} row${dropped === 1 ? "" : "s"} missing a required field`);
        return parts.length === 0 ? "No missing or mismatched values found." : `${parts.join(", ")}.`;
      });

      await runStep("crossref", async () => {
        const checks = crossReferenceDatasets(cleaningResults);
        setCrossRefChecks(checks);
        const allClean = checks.every((c) => c.clean);
        return allClean
          ? "All cross-file references reconciled cleanly."
          : "Some records didn't reconcile — see detail below.";
      });

      setCleaningResults(cleaningResults);
      setStatus("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong while processing your files.";
      setError(message);
      setStatus("error", message);
    }
  }

  const isDone = completed.size === STEP_ORDER.length && !error;
  const isAwaitingReview = reviewDatasets !== null && !completed.has("review");
  const progressPct = Math.round((completed.size / STEP_ORDER.length) * 100);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <FlowProgress current="processing" />

      <div className="mt-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          Cleaning &amp; validating your data
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every fix is logged with a count — nothing is changed silently.
        </p>
      </div>

      <div className="mt-8 space-y-1">
        <Progress value={progressPct} className="h-1.5" />
        <p className="text-right text-xs text-muted-foreground">{progressPct}%</p>
      </div>

      <ol className="mt-6 divide-y divide-border rounded-xl border border-border">
        {STEP_ORDER.map((id, index) => {
          const isComplete = completed.has(id);
          const isActive = !isComplete && completed.size === index && !error;

          return (
            <li key={id} className="flex items-start gap-3 px-4 py-4">
              <span className="mt-0.5 shrink-0">
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-brand" />
                ) : isActive ? (
                  <LoaderCircle className="h-5 w-5 animate-spin text-brand" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/40" />
                )}
              </span>
              <div>
                <p className={cn("text-sm font-medium", !isComplete && !isActive && "text-muted-foreground")}>
                  {STEP_LABELS[id]}
                </p>
                {stepDetail[id] && (
                  <p className="text-xs text-muted-foreground">{stepDetail[id]}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isAwaitingReview && reviewDatasets && (
        <div className="mt-6">
          <ColumnMappingReview datasets={reviewDatasets} onConfirm={handleConfirmMapping} />
        </div>
      )}

      {isDone && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(Object.keys(results) as DatasetKey[]).map((key) => {
              const r = results[key]!;
              return (
                <div key={key} className="rounded-xl border border-border p-4">
                  <p className="text-sm font-medium">{DATASET_LABELS[key]}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.counts.cleanRowCount.toLocaleString()} clean rows from{" "}
                    {r.counts.totalRawRows.toLocaleString()} uploaded
                    {r.counts.duplicatesRemoved > 0 && ` · ${r.counts.duplicatesRemoved} duplicates removed`}
                    {r.counts.nullsHandled > 0 && ` · ${r.counts.nullsHandled} nulls handled`}
                    {r.counts.rowsDroppedMissingRequired > 0 &&
                      ` · ${r.counts.rowsDroppedMissingRequired} rows dropped`}
                  </p>
                </div>
              );
            })}
          </div>

          {crossRefChecks.length > 0 && (
            <div className="rounded-xl border border-border p-4">
              <p className="text-sm font-medium">Cross-file reconciliation</p>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                {crossRefChecks.map((check) => (
                  <li key={check.label} className="flex items-start gap-2">
                    {check.clean ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    )}
                    <span>{check.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 flex justify-end border-t border-border pt-6">
        <Button
          size="lg"
          disabled={!isDone}
          onClick={() => router.push("/insights")}
          className="gap-2"
        >
          View insights dashboard
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
