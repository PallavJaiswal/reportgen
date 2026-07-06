"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/format";

export type CategoryDatum = { dimensionValue: string; current: number };

export function CategoryBarChart({
  data,
  currencyCode = "USD",
  maxItems = 6,
}: {
  data: CategoryDatum[];
  currencyCode?: string;
  maxItems?: number;
}) {
  const rows = [...data].sort((a, b) => b.current - a.current).slice(0, maxItems);

  if (rows.length === 0) {
    return <p className="py-8 text-center text-xs text-muted-foreground">No data for this view.</p>;
  }

  return (
    <div style={{ height: Math.max(rows.length * 36, 120) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatCurrency(v, currencyCode)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="dimensionValue"
            tick={{ fill: "var(--foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={90}
          />
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value), currencyCode), "Revenue"]}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="current" fill="var(--brand)" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
