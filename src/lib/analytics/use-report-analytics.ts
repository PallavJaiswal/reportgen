"use client";

import { useMemo } from "react";
import { useReportStore } from "@/lib/store/report-store";
import { computeKpiTrends, computeKpiRangeTrend, monthlyRevenueSeries } from "@/lib/stats/kpis";
import {
  detectSkuUnitAnomalies,
  detectSkuReturnAnomalies,
  detectRollingBaselineAnomalies,
  type Anomaly,
} from "@/lib/stats/anomalies";
import {
  rankPerformers,
  rankPerformersInRange,
  getAvailableChannels,
  filterRowsByChannel,
} from "@/lib/stats/performers";
import { synthesizeRisksAndOpportunities, rankInventoryRisk } from "@/lib/stats/risks";
import {
  getAvailableCurrencies,
  getDefaultCurrency,
  filterRowsByCurrency,
  computeCurrencyBreakdown,
  computeDimensionBreakdownByCurrency,
} from "@/lib/stats/currency";
import {
  getDataDateBounds,
  filterRowsByDateRange,
  getPreviousEquivalentRange,
  formatRangeLabel,
  anomalyOverlapsRange,
  monthToRange,
} from "@/lib/stats/date-range";
import { strField, numField, monthKey } from "@/lib/stats/aggregate";
import { formatMonthLabel } from "@/lib/format";

export type AnomalySensitivity = "strict" | "standard" | "lenient";
export type AnomalyDetectionMethod = "zscore" | "iqr";

export type AnomalyConfig = {
  method: AnomalyDetectionMethod;
  sensitivity: AnomalySensitivity;
};

const ZSCORE_THRESHOLDS: Record<AnomalySensitivity, number> = {
  strict: 3.5,
  standard: 2.5,
  lenient: 1.75,
};
const IQR_THRESHOLDS: Record<AnomalySensitivity, number> = {
  strict: 3,
  standard: 1.5,
  lenient: 0.75,
};
const ROLLING_BASELINE_THRESHOLDS: Record<AnomalySensitivity, number> = {
  strict: 0.4,
  standard: 0.25,
  lenient: 0.15,
};

export function useReportAnalytics(anomalyConfig: AnomalyConfig) {
  const cleaningResults = useReportStore((s) => s.cleaningResults);
  const selectedCurrency = useReportStore((s) => s.selectedCurrency);
  const dateRange = useReportStore((s) => s.dateRange);
  const selectedChannel = useReportStore((s) => s.selectedChannel);

  return useMemo(() => {
    const rawSalesRows = cleaningResults.sales?.rows ?? [];
    const rawOrdersRows = cleaningResults.orders?.rows ?? [];
    const inventoryRows = cleaningResults.inventory?.rows ?? [];
    const rawReturnsRows = cleaningResults.returns?.rows ?? [];

    const dataDateBounds = getDataDateBounds(rawSalesRows);
    const previousRange = dateRange ? getPreviousEquivalentRange(dateRange) : null;

    // Even with no explicit range picked, the KPI cards default to "current
    // month" — so the currency breakdown must be scoped to that same month,
    // never the full upload history, or its "Revenue" column silently
    // disagrees with the "Total revenue" card sitting right above it.
    const displayRange = dateRange ?? (dataDateBounds ? monthToRange(monthKey(dataDateBounds.end)) : null);

    const rangeSales = filterRowsByDateRange(rawSalesRows, "date", displayRange);
    const rangeOrders = filterRowsByDateRange(rawOrdersRows, "orderDate", displayRange);
    const rangeReturns = filterRowsByDateRange(rawReturnsRows, "returnDate", displayRange);

    // Channel scoping, computed independent of currency — unlike currency,
    // channels can be validly summed together, so this is a plain optional
    // narrowing filter rather than a forced choice.
    const availableChannels = getAvailableChannels(rangeSales, rangeOrders);
    const effectiveChannel =
      selectedChannel && availableChannels.includes(selectedChannel) ? selectedChannel : null;

    const channelSales = filterRowsByChannel(rangeSales, effectiveChannel);
    const channelOrders = filterRowsByChannel(rangeOrders, effectiveChannel);
    // Returns has no channel field in the schema at all, so it can never be
    // scoped to one channel — it always reflects every channel combined.
    // A caveat on Return rate (below) makes that explicit instead of quietly
    // mixing an unscoped number into an otherwise channel-scoped view.
    const channelReturns = rangeReturns;

    const availableCurrencies = getAvailableCurrencies({
      salesRows: channelSales,
      ordersRows: channelOrders,
      returnsRows: channelReturns,
    });
    const defaultCurrency = getDefaultCurrency(channelSales);
    const effectiveCurrency =
      availableCurrencies.length > 1 ? (selectedCurrency ?? defaultCurrency) : null;

    const currencyBreakdown =
      availableCurrencies.length > 1
        ? computeCurrencyBreakdown({ salesRows: channelSales, ordersRows: channelOrders, returnsRows: channelReturns })
        : [];

    // Region/channel/SKU revenue, grouped per currency rather than collapsed
    // to whichever currency is "active" — otherwise switching the currency
    // selector above can make these breakdowns shrink to a single category
    // (e.g. one channel) whenever that currency only touches one of them,
    // which reads as broken rather than as a real multi-currency picture.
    const revenueByCurrency =
      availableCurrencies.length > 1
        ? {
            sku: computeDimensionBreakdownByCurrency(channelSales, "sku"),
            region: computeDimensionBreakdownByCurrency(channelSales, "region"),
            channel: computeDimensionBreakdownByCurrency(channelSales, "channel"),
          }
        : null;

    // Currency- and channel-filtered but full history (not range-limited) —
    // anomaly z-score/IQR baselines need enough historical buckets to be
    // statistically meaningful, and the trend chart shows the whole story
    // with the selected window highlighted rather than truncated.
    const currencyFullSales = filterRowsByChannel(filterRowsByCurrency(rawSalesRows, effectiveCurrency), effectiveChannel);
    const currencyFullOrders = filterRowsByChannel(filterRowsByCurrency(rawOrdersRows, effectiveCurrency), effectiveChannel);
    const currencyFullReturns = filterRowsByCurrency(rawReturnsRows, effectiveCurrency);

    // Every filter applied — what KPIs/performers/risks are computed from.
    const salesRows = filterRowsByDateRange(currencyFullSales, "date", dateRange);
    const ordersRows = filterRowsByDateRange(currencyFullOrders, "orderDate", dateRange);
    const returnsRows = filterRowsByDateRange(currencyFullReturns, "returnDate", dateRange);

    // Blank optional number fields default to 0 during cleaning, so if
    // unitCost was never actually mapped to a column, every row would
    // silently read as "cost $0" — inflating margin to a false 100% instead
    // of showing "N/A". Only trust the cost map when the field was mapped.
    const unitCostMapped = Boolean(cleaningResults.inventory?.mapping.fieldToHeader.unitCost);
    const unitCostBySku = new Map<string, number>();
    if (unitCostMapped) {
      for (const row of inventoryRows) {
        const sku = strField(row, "sku");
        if (sku && !unitCostBySku.has(sku)) unitCostBySku.set(sku, numField(row, "unitCost"));
      }
    }
    const marginCaveat = unitCostMapped
      ? null
      : "Add a \"Unit Cost\" column to your Inventory upload to calculate margin.";

    const kpiTrendsRaw = dateRange
      ? computeKpiRangeTrend({ salesRows, ordersRows, returnsRows, unitCostBySku }, dateRange, previousRange!)
      : computeKpiTrends({ salesRows, ordersRows, returnsRows, unitCostBySku });

    // Returns can't be scoped to a channel (see channelReturns above), so a
    // channel-filtered return rate would silently divide all-channel returns
    // by one channel's units — a wrong number, not just an approximate one.
    // Null it out with a caveat instead of showing something misleading.
    const returnRateCaveat = effectiveChannel
      ? `Your Returns data isn't tagged by channel, so return rate can't be scoped to "${effectiveChannel}" — it would wrongly divide all-channel returns by one channel's units.`
      : null;
    const kpiTrends = effectiveChannel
      ? {
          ...kpiTrendsRaw,
          rows: kpiTrendsRaw.rows.map((row) =>
            row.id === "returnRate" ? { ...row, current: null, mom: null, qoq: null, yoy: null } : row
          ),
        }
      : kpiTrendsRaw;
    const revenueTrend = monthlyRevenueSeries(currencyFullSales);

    const threshold =
      anomalyConfig.method === "zscore"
        ? ZSCORE_THRESHOLDS[anomalyConfig.sensitivity]
        : IQR_THRESHOLDS[anomalyConfig.sensitivity];
    const rollingThreshold = ROLLING_BASELINE_THRESHOLDS[anomalyConfig.sensitivity];

    const allAnomalies: Anomaly[] = [
      ...detectSkuUnitAnomalies(currencyFullSales, anomalyConfig.method, threshold),
      ...detectSkuReturnAnomalies(currencyFullReturns, anomalyConfig.method, threshold),
      ...detectRollingBaselineAnomalies(currencyFullSales, rollingThreshold),
    ].sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
    const anomalies = dateRange
      ? allAnomalies.filter((a) => anomalyOverlapsRange(a, dateRange))
      : allAnomalies;

    const anchorMonth = kpiTrends.anchorMonth;
    const performers = dateRange
      ? {
          sku: rankPerformersInRange(currencyFullSales, "sku", dateRange, previousRange!),
          region: rankPerformersInRange(currencyFullSales, "region", dateRange, previousRange!),
          channel: rankPerformersInRange(currencyFullSales, "channel", dateRange, previousRange!),
        }
      : {
          sku: anchorMonth ? rankPerformers(currencyFullSales, "sku", anchorMonth) : [],
          region: anchorMonth ? rankPerformers(currencyFullSales, "region", anchorMonth) : [],
          channel: anchorMonth ? rankPerformers(currencyFullSales, "channel", anchorMonth) : [],
        };

    const risks = synthesizeRisksAndOpportunities({
      inventoryRows,
      skuPerformers: performers.sku,
      regionPerformers: performers.region,
      anomalies,
    });
    const inventoryHealth = rankInventoryRisk(inventoryRows);

    const periodLabel = dateRange
      ? formatRangeLabel(dateRange)
      : anchorMonth
        ? formatMonthLabel(anchorMonth)
        : "No data yet";
    const comparisonLabel = dateRange ? "vs. prior period" : "MoM";

    return {
      hasSales: rawSalesRows.length > 0,
      anchorMonth,
      dateRange,
      dataDateBounds,
      periodLabel,
      comparisonLabel,
      kpiTrends,
      revenueTrend,
      anomalies,
      performers,
      risks,
      inventoryHealth,
      availableCurrencies,
      effectiveCurrency,
      currencyBreakdown,
      revenueByCurrency,
      marginCaveat,
      availableChannels,
      effectiveChannel,
      returnRateCaveat,
      hasOrdersData: Boolean(cleaningResults.orders),
      hasReturnsData: Boolean(cleaningResults.returns),
      hasInventoryData: Boolean(cleaningResults.inventory),
    };
  }, [cleaningResults, anomalyConfig.method, anomalyConfig.sensitivity, selectedCurrency, dateRange, selectedChannel]);
}
