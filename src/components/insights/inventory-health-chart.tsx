"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatNumber } from "@/lib/format";
import type { InventoryHealthRow } from "@/lib/stats/risks";

const REORDER_COLOR = "#fab219";

export function InventoryHealthChart({ data, maxItems = 8 }: { data: InventoryHealthRow[]; maxItems?: number }) {
  const rows = data.slice(0, maxItems);

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        No SKUs are at or below their reorder point right now.
      </p>
    );
  }

  return (
    <div style={{ height: Math.max(rows.length * 40, 140) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatNumber(v)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: "var(--foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip
            formatter={(value, name) => [formatNumber(Number(value)), name]}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="onHand" name="On hand" fill="var(--brand)" radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false} />
          <Bar
            dataKey="reorderPoint"
            name="Reorder point"
            fill={REORDER_COLOR}
            radius={[0, 4, 4, 0]}
            maxBarSize={14}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
