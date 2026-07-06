"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import type { DatasetSchema, FieldMatchType } from "@/lib/data/schema";
import type { DatasetKey } from "@/lib/store/report-store";

const NONE_VALUE = "__none__";

export type MappingReviewDataset = {
  key: DatasetKey;
  schema: DatasetSchema;
  headers: string[];
  fieldToHeader: Record<string, string | null>;
  matchType: Record<string, FieldMatchType>;
  /** A sample of raw parsed rows, used only to warn when a guessed column
   * is blank in the actual file (before rows get dropped during cleaning). */
  sampleRows: Record<string, string>[];
};

function MatchBadge({ matchType, required, hasHeader }: { matchType: FieldMatchType; required: boolean; hasHeader: boolean }) {
  if (!hasHeader) {
    return (
      <Badge variant={required ? "destructive" : "secondary"} className="gap-1">
        {required && <AlertTriangle className="h-3 w-3" />}
        {required ? "Required — not mapped" : "Not mapped"}
      </Badge>
    );
  }
  if (matchType === "exact") {
    return <Badge variant="outline">Auto-matched</Badge>;
  }
  if (matchType === "manual") {
    return (
      <Badge variant="outline" className="border-brand/40 text-brand">
        Set by you
      </Badge>
    );
  }
  // fuzzy
  return (
    <Badge variant="outline" className="border-[#fab219]/50 text-[#a86a00] dark:text-[#fab219]">
      Best guess — verify
    </Badge>
  );
}

function countBlanks(rows: Record<string, string>[], header: string): number {
  let blank = 0;
  for (const row of rows) {
    const v = row[header];
    if (v === undefined || v === null || String(v).trim() === "") blank++;
  }
  return blank;
}

/** Only meaningful for required fields — a blank optional field just gets
 * filled with a default, but a blank required field drops the whole row. */
function BlankDataWarning({ rows, header }: { rows: Record<string, string>[]; header: string }) {
  if (rows.length === 0) return null;
  const blank = countBlanks(rows, header);
  if (blank === 0) return null;

  const allBlank = blank === rows.length;
  return (
    <p
      className={`mt-1 flex items-start gap-1 text-xs ${allBlank ? "text-destructive" : "text-[#a86a00] dark:text-[#fab219]"}`}
    >
      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
      {allBlank
        ? `Blank in all ${rows.length} sampled rows — matching rows will be dropped.`
        : `Blank in ${blank} of ${rows.length} sampled rows — those rows will be dropped.`}
    </p>
  );
}

export function ColumnMappingReview({
  datasets,
  onConfirm,
}: {
  datasets: MappingReviewDataset[];
  onConfirm: (overrides: Partial<Record<DatasetKey, Record<string, string | null>>>) => void;
}) {
  const [selections, setSelections] = useState<Record<DatasetKey, Record<string, string | null>>>(() => {
    const initial = {} as Record<DatasetKey, Record<string, string | null>>;
    for (const d of datasets) initial[d.key] = { ...d.fieldToHeader };
    return initial;
  });

  function setFieldMapping(datasetKey: DatasetKey, fieldKey: string, header: string | null) {
    setSelections((prev) => ({
      ...prev,
      [datasetKey]: { ...prev[datasetKey], [fieldKey]: header },
    }));
  }

  const missingRequired = useMemo(() => {
    const missing: string[] = [];
    for (const d of datasets) {
      for (const field of d.schema.fields) {
        if (field.required && !selections[d.key]?.[field.key]) {
          missing.push(`${d.schema.label} — ${field.label}`);
        }
      }
    }
    return missing;
  }, [datasets, selections]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Review column mapping</h2>
        <p className="text-sm text-muted-foreground">
          We matched each field automatically — double-check anything flagged &ldquo;best guess,&rdquo;
          and fix or fill in anything wrong or missing before continuing.
        </p>
      </div>

      {datasets.map((d) => (
        <Card key={d.key}>
          <CardHeader>
            <CardTitle className="text-sm">{d.schema.label}</CardTitle>
            <CardDescription>{d.headers.length} columns detected in your file</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Matched column</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.schema.fields.map((field) => {
                  const currentHeader = selections[d.key]?.[field.key] ?? null;
                  const isUnchanged = currentHeader === d.fieldToHeader[field.key];
                  const effectiveMatchType: FieldMatchType = isUnchanged
                    ? d.matchType[field.key]
                    : currentHeader
                      ? "manual"
                      : "none";

                  return (
                    <TableRow key={field.key}>
                      <TableCell className="font-medium align-top">
                        {field.label}
                        {field.required && <span className="ml-1 text-brand">*</span>}
                      </TableCell>
                      <TableCell className="align-top">
                        <Select
                          value={currentHeader ?? NONE_VALUE}
                          onValueChange={(v) => setFieldMapping(d.key, field.key, v === NONE_VALUE ? null : v)}
                        >
                          <SelectTrigger className="w-56">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>Not mapped</SelectItem>
                            {d.headers.map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {field.required && currentHeader && (
                          <BlankDataWarning rows={d.sampleRows} header={currentHeader} />
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <MatchBadge
                          matchType={effectiveMatchType}
                          required={field.required}
                          hasHeader={Boolean(currentHeader)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {missingRequired.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Map these required fields to continue:</p>
            <p className="text-xs">{missingRequired.join(", ")}</p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={missingRequired.length > 0}
          onClick={() => onConfirm(selections)}
          className="gap-2"
        >
          {missingRequired.length === 0 && <CheckCircle2 className="h-4 w-4" />}
          Confirm mapping &amp; continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
