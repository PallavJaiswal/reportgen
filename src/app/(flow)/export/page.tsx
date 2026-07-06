"use client";

import { useState } from "react";
import Link from "next/link";
import { FlowProgress } from "@/components/flow-progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet, ArrowLeft, Loader2, AlertTriangle, Search, Info } from "lucide-react";
import { useReportAnalytics } from "@/lib/analytics/use-report-analytics";
import { useReportStore } from "@/lib/store/report-store";
import { useActionTrackingStore } from "@/lib/store/action-tracking-store";
import { useContextNotesStore } from "@/lib/store/context-notes-store";
import { buildExportData } from "@/lib/export/build-export-data";
import { downloadExcelReport } from "@/lib/export/download-excel";

export default function ExportPage() {
  const analytics = useReportAnalytics({ method: "zscore", sensitivity: "standard" });
  const cleaningResults = useReportStore((s) => s.cleaningResults);
  const executiveSummary = useReportStore((s) => s.executiveSummary);
  const actionedRecommendations = useActionTrackingStore((s) => s.actionedRecommendations);
  const contextNotes = useContextNotesStore((s) => s.notes);

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getExportData() {
    return buildExportData({
      periodLabel: analytics.periodLabel,
      comparisonLabel: analytics.comparisonLabel,
      kpiRows: analytics.kpiTrends.rows,
      anomalies: analytics.anomalies,
      topPerformers: analytics.performers.sku.slice(0, 5),
      bottomPerformers: [...analytics.performers.sku].reverse().slice(0, 5),
      risks: analytics.risks,
      executiveSummary,
      actionedRecommendations,
      cleaningResults,
      availableCurrencies: analytics.availableCurrencies,
      reportingCurrency: analytics.effectiveCurrency,
      contextNotes: contextNotes.map((n) => n.text),
      channelFilter: analytics.effectiveChannel,
    });
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    setError(null);
    try {
      const { downloadPdfReport } = await import("@/lib/export/download-pdf");
      await downloadPdfReport(getExportData());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate the PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  function handleDownloadExcel() {
    setDownloadingExcel(true);
    setError(null);
    try {
      downloadExcelReport(getExportData());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate the Excel workbook.");
    } finally {
      setDownloadingExcel(false);
    }
  }

  if (!analytics.hasSales) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <FlowProgress current="export" />
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Search className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">No processed data yet</p>
            <p className="text-xs text-muted-foreground">
              Upload and validate your data first — exports are built from that pipeline.
            </p>
          </div>
          <Button render={<Link href="/upload" />}>Go to upload</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <FlowProgress current="export" />

      <div className="mt-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          Export your report
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Showing: <span className="font-medium text-foreground">{analytics.periodLabel}</span>
          {analytics.effectiveCurrency ? ` · ${analytics.effectiveCurrency}` : ""}
          {analytics.effectiveChannel ? ` · ${analytics.effectiveChannel} channel` : ""}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Download a presentation-ready copy of this analysis.
        </p>
      </div>

      {analytics.availableCurrencies.length > 1 && (
        <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <p className="text-xs text-foreground">
            This data contains multiple currencies. These exports report{" "}
            <span className="font-medium">{analytics.effectiveCurrency}</span> figures only — amounts in
            other currencies ({analytics.availableCurrencies.filter((c) => c !== analytics.effectiveCurrency).join(", ")}
            ) are excluded, never blended in.{" "}
            <Link href="/insights" className="text-brand underline underline-offset-2">
              Change reporting currency
            </Link>
            .
          </p>
        </div>
      )}

      {analytics.effectiveChannel && (
        <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <p className="text-xs text-foreground">
            Filtered to the <span className="font-medium">{analytics.effectiveChannel}</span> channel only.
            Return rate still reflects all channels combined, since Returns has no channel field in your upload.{" "}
            <Link href="/insights" className="text-brand underline underline-offset-2">
              Change channel
            </Link>
            .
          </p>
        </div>
      )}

      {!executiveSummary && (
        <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            You haven&apos;t generated an executive summary yet — exports will still include KPIs, anomalies,
            and cleaned data, but the narrative section will be empty.{" "}
            <Link href="/summary" className="text-brand underline underline-offset-2">
              Generate one on the Summary page
            </Link>
            .
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
              <FileText className="h-5 w-5" />
            </span>
            <CardTitle className="mt-3 text-base">PDF report</CardTitle>
            <CardDescription>
              Styled management report — executive summary, KPIs, anomalies, and recommendations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDownloadPdf} disabled={downloadingPdf} className="w-full gap-2">
              {downloadingPdf && <Loader2 className="h-4 w-4 animate-spin" />}
              Download PDF
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <CardTitle className="mt-3 text-base">Excel workbook</CardTitle>
            <CardDescription>
              Cleaned datasets, KPI tables, and anomaly detail on separate sheets for further analysis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDownloadExcel} disabled={downloadingExcel} className="w-full gap-2">
              {downloadingExcel && <Loader2 className="h-4 w-4 animate-spin" />}
              Download Excel
            </Button>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-8 flex justify-start border-t border-border pt-6">
        <Button
          variant="ghost"
          className="gap-2"
          render={<Link href="/summary" />}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to summary
        </Button>
      </div>
    </div>
  );
}
