import { CategoryBarChart } from "./category-bar-chart";
import type { PerformerRow } from "@/lib/stats/performers";
import type { CurrencyDimensionGroup } from "@/lib/stats/currency";

/** Renders a single chart when the data is unambiguous, or one independent
 * mini-chart per currency when there's more than one — each with its own
 * axis scale, so revenue in different currencies is never plotted on a
 * shared scale that would visually imply they're comparable magnitudes. */
export function DimensionByCurrencyPanel({
  singleCurrencyData,
  byCurrency,
  currencyCode,
}: {
  singleCurrencyData: PerformerRow[];
  byCurrency: CurrencyDimensionGroup[] | null;
  currencyCode: string;
}) {
  if (!byCurrency) {
    return <CategoryBarChart data={singleCurrencyData} currencyCode={currencyCode} />;
  }

  return (
    <div className="space-y-5">
      {byCurrency.map((group) => (
        <div key={group.currency}>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{group.currency}</p>
          <CategoryBarChart data={group.rows} currencyCode={group.currency} maxItems={5} />
        </div>
      ))}
    </div>
  );
}
