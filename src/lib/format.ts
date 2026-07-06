import type { KpiFormat } from "@/lib/stats/kpis";

export function formatCurrency(value: number, currencyCode = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    // currencyCode came from free-text data and isn't a valid ISO 4217 code
    // (e.g. a typo'd currency column) — fall back to a labeled plain number
    // rather than let Intl throw and blank the whole report.
    return `${currencyCode} ${formatNumber(value)}`;
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatKpiValue(value: number | null, format: KpiFormat, currencyCode = "USD"): string {
  if (value === null) return "—";
  if (format === "currency") return formatCurrency(value, currencyCode);
  if (format === "percent") return formatPercent(value);
  return formatNumber(value);
}

export function formatDeltaPct(value: number | null): string {
  if (value === null) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
