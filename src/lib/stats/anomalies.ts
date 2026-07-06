import type { CanonicalRow } from "@/lib/data/clean-dataset";
import {
  Bucket,
  bucketRowsByDimension,
  mean,
  monthKey,
  numField,
  quantile,
  stdDev,
  weekKey,
} from "./aggregate";

export type AnomalyMethod = "zscore" | "iqr" | "rolling-baseline";

export type Anomaly = {
  id: string;
  method: AnomalyMethod;
  threshold: number;
  dimensionType: "region" | "sku";
  dimensionValue: string;
  metricLabel: string;
  periodLabel: string;
  period: string;
  observed: number;
  baseline: number;
  deviation: number;
  severity: "high" | "medium";
  direction: "above" | "below";
  sourceRows: CanonicalRow[];
};

const MIN_SERIES_LENGTH = 6;

function detectInSeries(
  series: Bucket[],
  method: "zscore" | "iqr",
  threshold: number,
  dimensionType: "region" | "sku",
  dimensionValue: string,
  metricLabel: string,
  periodLabel: string
): Anomaly[] {
  if (series.length < MIN_SERIES_LENGTH) return [];
  const values = series.map((b) => b.value);
  const anomalies: Anomaly[] = [];

  if (method === "zscore") {
    const m = mean(values);
    const s = stdDev(values, m);
    if (s === 0) return [];
    for (const point of series) {
      const z = (point.value - m) / s;
      if (Math.abs(z) >= threshold) {
        anomalies.push({
          id: `${dimensionType}:${dimensionValue}:${point.key}:zscore`,
          method,
          threshold,
          dimensionType,
          dimensionValue,
          metricLabel,
          periodLabel,
          period: point.key,
          observed: point.value,
          baseline: m,
          deviation: z,
          severity: Math.abs(z) >= threshold + 1.5 ? "high" : "medium",
          direction: z >= 0 ? "above" : "below",
          sourceRows: point.rows,
        });
      }
    }
  } else {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    if (iqr === 0) return [];
    const lower = q1 - threshold * iqr;
    const upper = q3 + threshold * iqr;
    const mid = (q1 + q3) / 2;
    for (const point of series) {
      if (point.value < lower || point.value > upper) {
        const deviation = (point.value - mid) / iqr;
        anomalies.push({
          id: `${dimensionType}:${dimensionValue}:${point.key}:iqr`,
          method,
          threshold,
          dimensionType,
          dimensionValue,
          metricLabel,
          periodLabel,
          period: point.key,
          observed: point.value,
          baseline: mid,
          deviation,
          severity: point.value > upper + iqr || point.value < lower - iqr ? "high" : "medium",
          direction: point.value >= upper ? "above" : "below",
          sourceRows: point.rows,
        });
      }
    }
  }

  return anomalies;
}

/** z-score or IQR outliers in a per-SKU weekly units-sold series — tuned to
 * catch multi-day promo spikes and single-day unexplained spikes alike. */
export function detectSkuUnitAnomalies(
  salesRows: CanonicalRow[],
  method: "zscore" | "iqr",
  threshold: number
): Anomaly[] {
  const bySku = bucketRowsByDimension(salesRows, "sku", "date", weekKey, (r) =>
    numField(r, "units")
  );
  const anomalies: Anomaly[] = [];
  for (const [sku, series] of bySku) {
    anomalies.push(
      ...detectInSeries(series, method, threshold, "sku", sku, "Weekly units sold", "week of")
    );
  }
  return anomalies.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
}

/** z-score or IQR outliers in a per-SKU monthly returned-units series —
 * catches a defect wave concentrated in one SKU/month. */
export function detectSkuReturnAnomalies(
  returnsRows: CanonicalRow[],
  method: "zscore" | "iqr",
  threshold: number
): Anomaly[] {
  const bySku = bucketRowsByDimension(returnsRows, "sku", "returnDate", monthKey, (r) =>
    numField(r, "units")
  );
  const anomalies: Anomaly[] = [];
  for (const [sku, series] of bySku) {
    anomalies.push(
      ...detectInSeries(series, method, threshold, "sku", sku, "Monthly returned units", "in")
    );
  }
  return anomalies.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
}

/** Flags a region-month as a sustained level-shift anomaly when it deviates
 * from the trailing 3-month average by more than thresholdPct — built for
 * collapses/surges that a single-point z-score would average away. */
export function detectRollingBaselineAnomalies(
  salesRows: CanonicalRow[],
  thresholdPct: number,
  windowMonths = 3
): Anomaly[] {
  const byRegion = bucketRowsByDimension(salesRows, "region", "date", monthKey, (r) =>
    numField(r, "revenue")
  );
  const anomalies: Anomaly[] = [];

  for (const [region, series] of byRegion) {
    for (let i = windowMonths; i < series.length; i++) {
      const window = series.slice(i - windowMonths, i);
      const baseline = mean(window.map((b) => b.value));
      if (baseline === 0) continue;
      const point = series[i];
      const deviationPct = (point.value - baseline) / baseline;
      if (Math.abs(deviationPct) >= thresholdPct) {
        anomalies.push({
          id: `region:${region}:${point.key}:rolling`,
          method: "rolling-baseline",
          threshold: thresholdPct,
          dimensionType: "region",
          dimensionValue: region,
          metricLabel: "Monthly revenue",
          periodLabel: "in",
          period: point.key,
          observed: point.value,
          baseline,
          deviation: deviationPct,
          severity: Math.abs(deviationPct) >= thresholdPct * 1.6 ? "high" : "medium",
          direction: deviationPct >= 0 ? "above" : "below",
          sourceRows: point.rows,
        });
      }
    }
  }

  return anomalies.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
}
