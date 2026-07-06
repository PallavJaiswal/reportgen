"use client";

import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  ReferenceArea,
} from "recharts";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import type { Anomaly } from "@/lib/stats/anomalies";
import { monthKey } from "@/lib/stats/aggregate";
import type { DateRange } from "@/lib/stats/date-range";

type Point = { month: string; revenue: number };

// Fixed status hues (never themed) — see dataviz skill's status palette.
const STATUS_CRITICAL = "#d03b3b";
const STATUS_WARNING = "#fab219";

export function RevenueTrendChart({
  data,
  monthlyAnomalies,
  currencyCode = "USD",
  highlightRange,
}: {
  data: Point[];
  monthlyAnomalies: Map<string, Anomaly>;
  currencyCode?: string;
  highlightRange?: DateRange | null;
}) {
  const months = new Set(data.map((d) => d.month));
  const highlightStartMonth = highlightRange ? monthKey(highlightRange.start) : null;
  const highlightEndMonth = highlightRange ? monthKey(highlightRange.end) : null;
  const showHighlight =
    highlightStartMonth && highlightEndMonth && months.has(highlightStartMonth) && months.has(highlightEndMonth);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          {showHighlight && (
            <ReferenceArea
              x1={highlightStartMonth!}
              x2={highlightEndMonth!}
              fill="var(--brand)"
              fillOpacity={0.08}
              stroke="var(--brand)"
              strokeOpacity={0.25}
            />
          )}
          <XAxis
            dataKey="month"
            tickFormatter={(m: string) => formatMonthLabel(m)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v: number) => formatCurrency(v, currencyCode)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value), currencyCode), "Revenue"]}
            labelFormatter={(label) => formatMonthLabel(String(label))}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--brand)"
            strokeWidth={2}
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; payload?: Point }) => {
              const anomaly = props.payload ? monthlyAnomalies.get(props.payload.month) : undefined;
              if (!anomaly || props.cx === undefined || props.cy === undefined) {
                return <g key={props.payload?.month} />;
              }
              const color = anomaly.severity === "high" ? STATUS_CRITICAL : STATUS_WARNING;
              return (
                <circle
                  key={props.payload!.month}
                  cx={props.cx}
                  cy={props.cy}
                  r={5}
                  fill={color}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 5, fill: "var(--brand)", stroke: "var(--card)", strokeWidth: 2 }}
          >
            <LabelList
              dataKey="revenue"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={(props: any) => {
                const { x, y, index, value } = props;
                if (index !== data.length - 1 || x === undefined || y === undefined || value === undefined) {
                  return <g />;
                }
                return (
                  <text
                    x={Number(x)}
                    y={Number(y) - 12}
                    textAnchor="end"
                    fontSize={11}
                    fill="var(--foreground)"
                    fontWeight={500}
                  >
                    {formatCurrency(Number(value), currencyCode)}
                  </text>
                );
              }}
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
