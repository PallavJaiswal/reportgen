import { Globe } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/insights/info-tooltip";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { CurrencyBreakdownRow } from "@/lib/stats/currency";

export function CurrencySelector({
  availableCurrencies,
  effectiveCurrency,
  breakdown,
  periodLabel,
  effectiveChannel,
  onSelect,
}: {
  availableCurrencies: string[];
  effectiveCurrency: string | null;
  breakdown: CurrencyBreakdownRow[];
  periodLabel: string;
  effectiveChannel?: string | null;
  onSelect: (currency: string) => void;
}) {
  if (availableCurrencies.length <= 1) return null;

  return (
    <Card className="mt-6 border-brand/30 bg-brand/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div>
              <CardTitle className="text-base">Multiple currencies in this data</CardTitle>
              <CardDescription className="mt-0.5">
                Figures are never summed across currencies. Choose which one drives the dashboard,
                KPIs, and AI summary below — the breakdown for <span className="font-medium text-foreground">{periodLabel}</span> is
                still shown for every currency, so it always matches the KPI cards above.
              </CardDescription>
            </div>
          </div>
          <Select
            value={effectiveCurrency ?? undefined}
            onValueChange={(value) => value && onSelect(value)}
          >
            <SelectTrigger className="w-44 shrink-0">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {availableCurrencies.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  Reporting in {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Currency</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Units</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-1">
                  Returns
                  {effectiveChannel && (
                    <InfoTooltip
                      text={`Reflects all channels — Returns data has no channel field, so it can't be scoped to "${effectiveChannel}".`}
                    />
                  )}
                </span>
              </TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-1">
                  Refunds
                  {effectiveChannel && (
                    <InfoTooltip
                      text={`Reflects all channels — Returns data has no channel field, so it can't be scoped to "${effectiveChannel}".`}
                    />
                  )}
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {breakdown.map((row) => (
              <TableRow
                key={row.currency}
                className={row.currency === effectiveCurrency ? "bg-brand/5" : undefined}
              >
                <TableCell className="font-medium">
                  {row.currency}
                  {row.currency === effectiveCurrency && (
                    <span className="ml-2 text-xs font-normal text-brand">Active</span>
                  )}
                </TableCell>
                <TableCell>{formatCurrency(row.revenue, row.currency)}</TableCell>
                <TableCell>{formatNumber(row.units)}</TableCell>
                <TableCell>{formatNumber(row.orders)}</TableCell>
                <TableCell>{formatNumber(row.returns)}</TableCell>
                <TableCell>{formatCurrency(row.refund, row.currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
