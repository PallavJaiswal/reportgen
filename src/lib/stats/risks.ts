import type { CanonicalRow } from "@/lib/data/clean-dataset";
import { numField, strField } from "./aggregate";
import type { Anomaly } from "./anomalies";
import type { PerformerRow } from "./performers";

export type RiskOpportunity = {
  type: "risk" | "opportunity";
  title: string;
  detail: string;
};

const GROWTH_THRESHOLD = 0.3;

export type InventoryHealthRow = {
  label: string;
  onHand: number;
  reorderPoint: number;
  warehouse: string;
};

/** SKUs at or below their reorder point, worst-gap first — the numeric
 * companion to the text stockout risks below, for charting. */
export function rankInventoryRisk(inventoryRows: CanonicalRow[]): InventoryHealthRow[] {
  return inventoryRows
    .map((row) => ({
      label: strField(row, "productName") ?? strField(row, "sku") ?? "Unknown SKU",
      onHand: numField(row, "onHand"),
      reorderPoint: numField(row, "reorderPoint"),
      warehouse: strField(row, "warehouse") ?? "Unspecified warehouse",
    }))
    .filter((r) => r.reorderPoint > 0 && r.onHand <= r.reorderPoint)
    .sort((a, b) => a.onHand - a.reorderPoint - (b.onHand - b.reorderPoint));
}

/** Synthesizes plain-language risk/opportunity flags from inventory rules,
 * performer momentum, and the highest-severity anomalies — rule-based, no AI. */
export function synthesizeRisksAndOpportunities(params: {
  inventoryRows: CanonicalRow[];
  skuPerformers: PerformerRow[];
  regionPerformers: PerformerRow[];
  anomalies: Anomaly[];
}): RiskOpportunity[] {
  const items: RiskOpportunity[] = [];

  for (const row of params.inventoryRows) {
    const onHand = numField(row, "onHand");
    const reorderPoint = numField(row, "reorderPoint");
    if (reorderPoint > 0 && onHand <= reorderPoint) {
      const name = strField(row, "productName") ?? strField(row, "sku") ?? "Unknown SKU";
      const warehouse = strField(row, "warehouse") ?? "an unspecified warehouse";
      items.push({
        type: "risk",
        title: `Stockout risk: ${name}`,
        detail: `${onHand} units on hand at ${warehouse} vs. a reorder point of ${reorderPoint}.`,
      });
    }
  }

  const growing = [...params.skuPerformers]
    .filter((p) => (p.deltaPct ?? 0) > GROWTH_THRESHOLD)
    .sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0))[0];
  if (growing) {
    items.push({
      type: "opportunity",
      title: `${growing.dimensionValue} demand accelerating`,
      detail: `Revenue up ${(growing.deltaPct! * 100).toFixed(0)}% month-over-month.`,
    });
  }

  const declining = [...params.regionPerformers]
    .filter((p) => (p.deltaPct ?? 0) < -GROWTH_THRESHOLD)
    .sort((a, b) => (a.deltaPct ?? 0) - (b.deltaPct ?? 0))[0];
  if (declining) {
    items.push({
      type: "risk",
      title: `${declining.dimensionValue} region demand declining`,
      detail: `Revenue down ${Math.abs(declining.deltaPct! * 100).toFixed(0)}% month-over-month.`,
    });
  }

  const topAnomalies = params.anomalies.filter((a) => a.severity === "high").slice(0, 3);
  for (const a of topAnomalies) {
    items.push({
      type: a.direction === "above" ? "opportunity" : "risk",
      title: `${a.metricLabel} anomaly — ${a.dimensionValue}`,
      detail: `${a.periodLabel} ${a.period}: observed ${Math.round(a.observed).toLocaleString()} vs. an expected ~${Math.round(a.baseline).toLocaleString()}.`,
    });
  }

  return items.slice(0, 6);
}
