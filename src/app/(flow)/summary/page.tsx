"use client";

import { useState } from "react";
import Link from "next/link";
import { FlowProgress } from "@/components/flow-progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, ArrowRight, Sparkles, Loader2, AlertTriangle, Search } from "lucide-react";
import { useReportAnalytics } from "@/lib/analytics/use-report-analytics";
import { buildReportContext } from "@/lib/ai/build-report-context";
import { requestExecutiveSummary } from "@/lib/ai/client";
import { useActionTrackingStore } from "@/lib/store/action-tracking-store";
import { useContextNotesStore } from "@/lib/store/context-notes-store";
import { useReportStore } from "@/lib/store/report-store";
import { cn } from "@/lib/utils";
import { DemoLimitBanner } from "@/components/demo-limit-banner";

export default function SummaryPage() {
  const analytics = useReportAnalytics({ method: "zscore", sensitivity: "standard" });
  const { actionedRecommendations, toggleActioned, isActioned } = useActionTrackingStore();
  const contextNotes = useContextNotesStore((s) => s.notes);
  const summary = useReportStore((s) => s.executiveSummary);
  const setExecutiveSummary = useReportStore((s) => s.setExecutiveSummary);

  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const context = buildReportContext({
        periodLabel: analytics.periodLabel,
        comparisonLabel: analytics.comparisonLabel,
        kpiRows: analytics.kpiTrends.rows,
        anomalies: analytics.anomalies,
        skuPerformers: analytics.performers.sku,
        risks: analytics.risks,
        actionedRecommendations,
        reportingCurrency: analytics.effectiveCurrency,
        contextNotes: contextNotes.map((n) => n.text),
      });
      const result = await requestExecutiveSummary(context);
      setExecutiveSummary({
        headline: result.headline,
        sections: result.sections,
        recommendations: result.recommendations,
      });
      setLimitMessage(result.limited ? (result.limitMessage ?? null) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate the executive summary.");
    } finally {
      setLoading(false);
    }
  }

  if (!analytics.hasSales) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <FlowProgress current="summary" />
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Search className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">No processed data yet</p>
            <p className="text-xs text-muted-foreground">
              Upload and validate your data first — the summary is generated from that pipeline.
            </p>
          </div>
          <Button render={<Link href="/upload" />}>Go to upload</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <FlowProgress current="summary" />

      <div className="mt-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Executive summary
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Showing: <span className="font-medium text-foreground">{analytics.periodLabel}</span>
            {analytics.effectiveCurrency ? ` · ${analytics.effectiveCurrency}` : ""}
            {analytics.effectiveChannel ? ` · ${analytics.effectiveChannel} channel` : ""}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            The polished narrative your report exports with — generated from
            the anomalies, trends, and recommendations behind it.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {summary ? "Generated" : "Draft"}
        </Badge>
      </div>

      {!summary && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-brand" />
              Narrative
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Generate the executive summary from your processed data — it will
              synthesize the period&apos;s performance, the most material
              anomalies and their root causes, and the highest-leverage
              recommended actions, written in plain, decision-ready language.
            </p>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                Will include
              </p>
              <ul className="list-inside list-disc space-y-1">
                <li>Period performance vs. prior period</li>
                <li>Top risks and opportunities</li>
                <li>Recommended actions tied to specific KPIs</li>
                <li>Actions marked as taken from the previous report run</li>
              </ul>
            </div>
            <Button onClick={handleGenerate} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate executive summary
            </Button>
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {summary && (
        <div className="mt-8 space-y-6">
          {limitMessage && <DemoLimitBanner message={limitMessage} />}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-brand" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="rounded-lg border border-brand/20 bg-brand/5 px-3 py-2.5 text-sm font-medium leading-relaxed">
                {summary.headline}
              </p>
              {summary.sections.map((section, i) => (
                <div key={i}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                    {section.heading}
                  </p>
                  <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm leading-relaxed">
                    {section.bullets.map((bullet, j) => (
                      <li key={j}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommended actions</CardTitle>
              <CardDescription>
                Mark an action as taken and it&apos;s referenced the next time you generate a summary.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.recommendations.map((rec) => {
                const done = isActioned(rec.title);
                return (
                  <label
                    key={rec.title}
                    className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer"
                  >
                    <Checkbox
                      checked={done}
                      onCheckedChange={() => toggleActioned(rec.title)}
                      className="mt-0.5"
                    />
                    <div className={cn(done && "text-muted-foreground line-through decoration-muted-foreground/50")}>
                      <p className="text-sm font-medium">{rec.title}</p>
                      <p className="text-xs text-muted-foreground">{rec.detail}</p>
                      <Badge variant="outline" className="mt-1.5 text-[10px]">
                        {rec.relatedKpi}
                      </Badge>
                    </div>
                  </label>
                );
              })}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Regenerate
            </Button>
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-end border-t border-border pt-6">
        <Button
          size="lg"
          className="gap-2"
          render={<Link href="/export" />}
        >
          Continue to export
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
