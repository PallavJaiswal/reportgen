"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FlowProgress } from "@/components/flow-progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  TrendingDown,
  AlertTriangle,
  Trophy,
  MessageCircleQuestion,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Lightbulb,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useReportAnalytics, type AnomalyDetectionMethod, type AnomalySensitivity } from "@/lib/analytics/use-report-analytics";
import type { Anomaly } from "@/lib/stats/anomalies";
import type { PerformerDimension } from "@/lib/stats/performers";
import { formatKpiValue, formatDeltaPct, formatCurrency } from "@/lib/format";
import { RevenueTrendChart } from "@/components/insights/revenue-trend-chart";
import { DimensionByCurrencyPanel } from "@/components/insights/dimension-by-currency-panel";
import { InventoryHealthChart } from "@/components/insights/inventory-health-chart";
import { AnomalyDrilldownDialog } from "@/components/insights/anomaly-drilldown-dialog";
import { CurrencySelector } from "@/components/insights/currency-selector";
import { DateRangeSelector } from "@/components/insights/date-range-selector";
import { ChannelSelector } from "@/components/insights/channel-selector";
import { InfoTooltip } from "@/components/insights/info-tooltip";
import { ContextNotes } from "@/components/insights/context-notes";
import { buildReportContext } from "@/lib/ai/build-report-context";
import { requestAnswer } from "@/lib/ai/client";
import { useActionTrackingStore } from "@/lib/store/action-tracking-store";
import { useContextNotesStore } from "@/lib/store/context-notes-store";
import { useReportStore } from "@/lib/store/report-store";
import { DemoLimitBanner } from "@/components/demo-limit-banner";

type QAEntry = { question: string; answer: string; limitMessage?: string | null };

const SUGGESTED_QUESTIONS = [
  "What happened this period?",
  "What should I focus on next?",
  "How can I improve margins?",
  "What's driving the biggest anomaly?",
];

const STATUS_CRITICAL = "#d03b3b";
const STATUS_WARNING = "#fab219";

function deltaColorClass(deltaPct: number | null, higherIsBetter: boolean): string {
  if (deltaPct === null || deltaPct === 0) return "text-muted-foreground";
  const isGood = higherIsBetter ? deltaPct > 0 : deltaPct < 0;
  return isGood ? "text-[#0ca30c]" : "text-[#d03b3b]";
}

function formatDeviation(a: Anomaly): string {
  if (a.method === "zscore") return `z = ${a.deviation.toFixed(1)}`;
  if (a.method === "iqr") return `${a.deviation.toFixed(1)}x IQR`;
  return `${a.deviation > 0 ? "+" : ""}${(a.deviation * 100).toFixed(0)}% vs. trailing avg`;
}

const PERFORMER_DIMENSION_LABELS: Record<PerformerDimension, string> = {
  sku: "SKU",
  region: "Region",
  channel: "Channel",
};

function formatMethodCaption(a: Anomaly): string {
  if (a.method === "zscore") return `z-score method, threshold ${a.threshold}`;
  if (a.method === "iqr") return `IQR method, multiplier ${a.threshold}`;
  return `rolling 3-month baseline, threshold ${(a.threshold * 100).toFixed(0)}%`;
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const [method, setMethod] = useState<AnomalyDetectionMethod>("zscore");
  const [sensitivity, setSensitivity] = useState<AnomalySensitivity>("standard");
  const [performerDimension, setPerformerDimension] = useState<PerformerDimension>("sku");
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [question, setQuestion] = useState("");
  const [qaHistory, setQaHistory] = useState<QAEntry[]>([]);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  const analytics = useReportAnalytics({ method, sensitivity });
  const actionedRecommendations = useActionTrackingStore((s) => s.actionedRecommendations);
  const setSelectedCurrency = useReportStore((s) => s.setSelectedCurrency);
  const setDateRange = useReportStore((s) => s.setDateRange);
  const setSelectedChannel = useReportStore((s) => s.setSelectedChannel);
  const notes = useContextNotesStore((s) => s.notes);
  const reportingCurrency = analytics.effectiveCurrency ?? "USD";

  async function handleAsk(override?: string) {
    const trimmed = (override ?? question).trim();
    if (!trimmed) return;
    setQaLoading(true);
    setQaError(null);
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
        contextNotes: notes.map((n) => n.text),
      });
      const result = await requestAnswer(trimmed, context);
      setQaHistory((prev) => [
        ...prev,
        { question: trimmed, answer: result.answer, limitMessage: result.limited ? result.limitMessage : null },
      ]);
      setQuestion("");
    } catch (err) {
      setQaError(err instanceof Error ? err.message : "Failed to get an answer.");
    } finally {
      setQaLoading(false);
    }
  }

  const monthlyAnomalies = useMemo(() => {
    const map = new Map<string, Anomaly>();
    for (const anomaly of analytics.anomalies) {
      if (anomaly.method !== "rolling-baseline") continue;
      const existing = map.get(anomaly.period);
      if (!existing || Math.abs(anomaly.deviation) > Math.abs(existing.deviation)) {
        map.set(anomaly.period, anomaly);
      }
    }
    return map;
  }, [analytics.anomalies]);

  if (!analytics.hasSales) {
    return (
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <FlowProgress current="insights" />
        <div className="mt-16">
          <EmptyPanel
            icon={Search}
            title="No processed data yet"
            description="Upload and validate your data first — the insights dashboard reads from that pipeline."
          />
          <div className="mt-6 flex justify-center">
            <Button render={<Link href="/upload" />}>Go to upload</Button>
          </div>
        </div>
      </div>
    );
  }

  const performerRows = analytics.performers[performerDimension];
  const topPerformers = performerRows.slice(0, 5);
  const bottomPerformers = [...performerRows].reverse().slice(0, 5);
  const dimensionGroupsByCurrency = analytics.revenueByCurrency?.[performerDimension] ?? null;
  const visibleAnomalies = analytics.anomalies.slice(0, 12);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <FlowProgress current="insights" />

      <div className="mt-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Insights dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Showing: <span className="font-medium text-foreground">{analytics.periodLabel}</span>
            {analytics.effectiveCurrency ? ` · ${analytics.effectiveCurrency}` : ""}
            {analytics.effectiveChannel ? ` · ${analytics.effectiveChannel} channel` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ChannelSelector
            availableChannels={analytics.availableChannels}
            selectedChannel={analytics.effectiveChannel}
            onChange={setSelectedChannel}
          />
          <DateRangeSelector dataDateBounds={analytics.dataDateBounds} onChange={setDateRange} />
        </div>
      </div>

      <CurrencySelector
        availableCurrencies={analytics.availableCurrencies}
        effectiveCurrency={analytics.effectiveCurrency}
        breakdown={analytics.currencyBreakdown}
        periodLabel={analytics.periodLabel}
        effectiveChannel={analytics.effectiveChannel}
        onSelect={setSelectedCurrency}
      />

      <ContextNotes analytics={analytics} />

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {analytics.kpiTrends.rows.map((kpi) => {
          const caveat =
            kpi.id === "avgMargin"
              ? analytics.marginCaveat
              : kpi.id === "orders" && !analytics.hasOrdersData
                ? "No Orders file was uploaded — this shows Sales-derived data only."
                : kpi.id === "returnRate" && !analytics.hasReturnsData
                  ? "No Returns file was uploaded — this cannot be calculated."
                  : kpi.id === "returnRate" && analytics.returnRateCaveat
                    ? analytics.returnRateCaveat
                    : kpi.mom === null
                      ? `No prior-period data in your upload to compare against.`
                      : null;
          return (
            <Card key={kpi.id}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1 text-xs">
                  {kpi.label}
                  {caveat && <InfoTooltip text={caveat} />}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tracking-tight">
                  {formatKpiValue(kpi.current, kpi.format, reportingCurrency)}
                </p>
                <p className={`mt-1 text-xs ${deltaColorClass(kpi.mom, kpi.higherIsBetter)}`}>
                  {formatDeltaPct(kpi.mom)} {analytics.comparisonLabel}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {analytics.risks.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Risks &amp; opportunities</CardTitle>
            <CardDescription>Synthesized from anomalies, inventory, and performer trends.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {analytics.risks.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg border border-border p-3">
                {item.type === "risk" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#d03b3b]" />
                ) : (
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#0ca30c]" />
                )}
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {analytics.inventoryHealth.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Inventory at risk of stockout</CardTitle>
            <CardDescription>
              SKUs at or below their reorder point right now, worst gap first — independent of the reporting period above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InventoryHealthChart data={analytics.inventoryHealth} />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="trends" className="mt-8">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
          <TabsTrigger value="performers">Top / Bottom</TabsTrigger>
          <TabsTrigger value="qa">Ask a question</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly revenue trend</CardTitle>
              <CardDescription>
                Markers flag months where a region&apos;s revenue broke its trailing 3-month baseline.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueTrendChart
                data={analytics.revenueTrend}
                monthlyAnomalies={monthlyAnomalies}
                currencyCode={reportingCurrency}
                highlightRange={analytics.dateRange}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue by region</CardTitle>
                <CardDescription>
                  {analytics.periodLabel}
                  {analytics.revenueByCurrency ? " · every currency shown, never blended" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DimensionByCurrencyPanel
                  singleCurrencyData={analytics.performers.region}
                  byCurrency={analytics.revenueByCurrency?.region ?? null}
                  currencyCode={reportingCurrency}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue by channel</CardTitle>
                <CardDescription>
                  {analytics.periodLabel}
                  {analytics.revenueByCurrency ? " · every currency shown, never blended" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DimensionByCurrencyPanel
                  singleCurrencyData={analytics.performers.channel}
                  byCurrency={analytics.revenueByCurrency?.channel ?? null}
                  currencyCode={reportingCurrency}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Period-over-period</CardTitle>
              <CardDescription>
                {analytics.dateRange
                  ? "Every KPI vs. the immediately preceding period of equal length."
                  : "Every KPI vs. the prior month, quarter, and year."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>KPI</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>{analytics.comparisonLabel}</TableHead>
                    {!analytics.dateRange && (
                      <>
                        <TableHead>QoQ</TableHead>
                        <TableHead>YoY</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.kpiTrends.rows.map((kpi) => (
                    <TableRow key={kpi.id}>
                      <TableCell className="font-medium">{kpi.label}</TableCell>
                      <TableCell>{formatKpiValue(kpi.current, kpi.format, reportingCurrency)}</TableCell>
                      <TableCell className={deltaColorClass(kpi.mom, kpi.higherIsBetter)}>
                        {formatDeltaPct(kpi.mom)}
                      </TableCell>
                      {!analytics.dateRange && (
                        <>
                          <TableCell className={deltaColorClass(kpi.qoq, kpi.higherIsBetter)}>
                            {formatDeltaPct(kpi.qoq)}
                          </TableCell>
                          <TableCell className={deltaColorClass(kpi.yoy, kpi.higherIsBetter)}>
                            {formatDeltaPct(kpi.yoy)}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anomalies" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={method} onValueChange={(v) => setMethod(v as AnomalyDetectionMethod)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zscore">Z-score method</SelectItem>
                <SelectItem value="iqr">IQR method</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sensitivity} onValueChange={(v) => setSensitivity(v as AnomalySensitivity)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strict">Strict</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="lenient">Lenient</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {analytics.anomalies.length} anomal{analytics.anomalies.length === 1 ? "y" : "ies"} found
              {analytics.anomalies.length > visibleAnomalies.length ? ` — showing top ${visibleAnomalies.length}` : ""}.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Detected across your full upload history to build reliable statistical baselines —
            {analytics.dateRange ? " narrowed to the period selected above" : " independent of the reporting period above"}
            {analytics.availableCurrencies.length > 1 ? `, within ${reportingCurrency} only (switch the currency above to see others).` : "."}
          </p>

          {visibleAnomalies.length === 0 ? (
            <EmptyPanel
              icon={AlertTriangle}
              title="No anomalies at this sensitivity"
              description="Try a stricter or more lenient threshold above — nothing crossed the current one."
            />
          ) : (
            <div className="space-y-2">
              {visibleAnomalies.map((anomaly) => (
                <button
                  key={anomaly.id}
                  onClick={() => setSelectedAnomaly(anomaly)}
                  className="flex w-full items-start justify-between gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:border-foreground/30"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: anomaly.severity === "high" ? STATUS_CRITICAL : STATUS_WARNING,
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {anomaly.metricLabel} — {anomaly.dimensionValue}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {anomaly.periodLabel} {anomaly.period}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Observed {Math.round(anomaly.observed).toLocaleString()} vs. expected ~
                        {Math.round(anomaly.baseline).toLocaleString()} ({formatDeviation(anomaly)}) ·{" "}
                        {formatMethodCaption(anomaly)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {anomaly.direction === "above" ? (
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Badge variant={anomaly.severity === "high" ? "destructive" : "secondary"}>
                      {anomaly.severity === "high" ? "High" : "Medium"}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="performers" className="mt-4 space-y-4">
          <Select value={performerDimension} onValueChange={(v) => setPerformerDimension(v as PerformerDimension)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sku">By SKU</SelectItem>
              <SelectItem value="region">By region</SelectItem>
              <SelectItem value="channel">By channel</SelectItem>
            </SelectContent>
          </Select>

          {dimensionGroupsByCurrency ? (
            <div className="space-y-6">
              <p className="text-xs text-muted-foreground">
                Shown separately per currency — never blended into one ranking.
              </p>
              {dimensionGroupsByCurrency.map((group) => {
                const groupTop = group.rows.slice(0, 5);
                const groupBottom = [...group.rows].reverse().slice(0, 5);
                return (
                  <div key={group.currency}>
                    <p className="mb-2 text-sm font-medium">{group.currency}</p>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Trophy className="h-4 w-4 text-[#0ca30c]" />
                            Top {PERFORMER_DIMENSION_LABELS[performerDimension].toLowerCase()}s
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{PERFORMER_DIMENSION_LABELS[performerDimension]}</TableHead>
                                <TableHead>Revenue</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {groupTop.map((p) => (
                                <TableRow key={p.dimensionValue}>
                                  <TableCell className="font-medium">{p.dimensionValue}</TableCell>
                                  <TableCell>{formatCurrency(p.current, group.currency)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <TrendingDown className="h-4 w-4 text-[#d03b3b]" />
                            Bottom {PERFORMER_DIMENSION_LABELS[performerDimension].toLowerCase()}s
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{PERFORMER_DIMENSION_LABELS[performerDimension]}</TableHead>
                                <TableHead>Revenue</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {groupBottom.map((p) => (
                                <TableRow key={p.dimensionValue}>
                                  <TableCell className="font-medium">{p.dimensionValue}</TableCell>
                                  <TableCell>{formatCurrency(p.current, group.currency)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Trophy className="h-4 w-4 text-[#0ca30c]" />
                    Top performers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{PERFORMER_DIMENSION_LABELS[performerDimension]}</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>{analytics.comparisonLabel}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topPerformers.map((p) => (
                        <TableRow key={p.dimensionValue}>
                          <TableCell className="font-medium">{p.dimensionValue}</TableCell>
                          <TableCell>{formatKpiValue(p.current, "currency", reportingCurrency)}</TableCell>
                          <TableCell className={deltaColorClass(p.deltaPct, true)}>
                            {formatDeltaPct(p.deltaPct)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingDown className="h-4 w-4 text-[#d03b3b]" />
                    Bottom performers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{PERFORMER_DIMENSION_LABELS[performerDimension]}</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>{analytics.comparisonLabel}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bottomPerformers.map((p) => (
                        <TableRow key={p.dimensionValue}>
                          <TableCell className="font-medium">{p.dimensionValue}</TableCell>
                          <TableCell>{formatKpiValue(p.current, "currency", reportingCurrency)}</TableCell>
                          <TableCell className={deltaColorClass(p.deltaPct, true)}>
                            {formatDeltaPct(p.deltaPct)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="qa" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Ask a question about your data
              </CardTitle>
              <CardDescription>
                Ask what happened this period, why a KPI moved, or what to do next — answered from the exact
                KPIs, anomalies, and performers currently on screen.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {qaHistory.length > 0 && (
                <div className="space-y-3">
                  {qaHistory.map((entry, i) => (
                    <div key={i} className="space-y-1.5">
                      <p className="text-sm font-medium">{entry.question}</p>
                      {entry.limitMessage && <DemoLimitBanner message={entry.limitMessage} />}
                      <div className="flex items-start gap-1.5 rounded-lg border border-brand/20 bg-brand/5 p-3">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                        <p className="text-sm leading-relaxed">{entry.answer}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {qaError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{qaError}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_QUESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={qaLoading}
                    onClick={() => handleAsk(suggestion)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Ask a question about this report..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !qaLoading) handleAsk();
                  }}
                  disabled={qaLoading}
                />
                <Button onClick={() => handleAsk()} disabled={qaLoading || !question.trim()} className="gap-2 shrink-0">
                  {qaLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageCircleQuestion className="h-4 w-4" />
                  )}
                  Ask
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AnomalyDrilldownDialog
        anomaly={selectedAnomaly}
        open={selectedAnomaly !== null}
        onOpenChange={(open) => !open && setSelectedAnomaly(null)}
      />
    </div>
  );
}
