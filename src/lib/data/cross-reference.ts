import type { CleaningResult } from "./clean-dataset";
import type { DatasetKey } from "@/lib/store/report-store";

export type CrossReferenceCheck = {
  label: string;
  detail: string;
  clean: boolean;
};

function columnValues(result: CleaningResult | undefined, key: string): Set<string> {
  if (!result) return new Set();
  return new Set(
    result.rows
      .map((row) => row[key])
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  );
}

/** Reconciles SKUs and order IDs across datasets so mismatches surface
 * during validation instead of silently breaking later drill-downs. */
export function crossReferenceDatasets(
  results: Partial<Record<DatasetKey, CleaningResult>>
): CrossReferenceCheck[] {
  const checks: CrossReferenceCheck[] = [];

  const salesSkus = columnValues(results.sales, "sku");
  const inventorySkus = columnValues(results.inventory, "sku");
  const ordersIds = columnValues(results.orders, "orderId");
  const returnsOrderIds = columnValues(results.returns, "orderId");
  const returnsSkus = columnValues(results.returns, "sku");

  if (results.sales && results.inventory) {
    const unmatched = [...salesSkus].filter((sku) => !inventorySkus.has(sku));
    checks.push({
      label: "Sales SKUs vs. inventory",
      clean: unmatched.length === 0,
      detail:
        unmatched.length === 0
          ? `All ${salesSkus.size} SKUs sold have a matching inventory record.`
          : `${unmatched.length} of ${salesSkus.size} SKUs sold have no matching inventory record.`,
    });
  }

  if (results.returns && results.orders) {
    const unmatched = [...returnsOrderIds].filter((id) => !ordersIds.has(id));
    checks.push({
      label: "Return order IDs vs. orders",
      clean: unmatched.length === 0,
      detail:
        unmatched.length === 0
          ? `All ${returnsOrderIds.size} returns matched a known order.`
          : `${unmatched.length} of ${returnsOrderIds.size} returns reference an order ID not found in Orders.`,
    });
  }

  if (results.returns && results.sales) {
    const unmatched = [...returnsSkus].filter((sku) => !salesSkus.has(sku));
    checks.push({
      label: "Return SKUs vs. sales",
      clean: unmatched.length === 0,
      detail:
        unmatched.length === 0
          ? `All ${returnsSkus.size} returned SKUs matched a sales record.`
          : `${unmatched.length} of ${returnsSkus.size} returned SKUs have no matching sales record.`,
    });
  }

  if (checks.length === 0) {
    checks.push({
      label: "Cross-reference skipped",
      clean: true,
      detail: "Upload more than one dataset to enable cross-file checks.",
    });
  }

  return checks;
}
