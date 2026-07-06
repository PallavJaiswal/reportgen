"use client";

import { useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { buildRangePresets, type DateRange } from "@/lib/stats/date-range";

export function DateRangeSelector({
  dataDateBounds,
  onChange,
}: {
  dataDateBounds: DateRange | null;
  onChange: (range: DateRange | null) => void;
}) {
  const presets = useMemo(() => (dataDateBounds ? buildRangePresets(dataDateBounds) : []), [dataDateBounds]);
  const [selectedKey, setSelectedKey] = useState("currentMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  if (!dataDateBounds) return null;

  function handlePresetChange(key: string) {
    setSelectedKey(key);
    if (key === "custom") {
      const start = customStart || dataDateBounds!.start;
      const end = customEnd || dataDateBounds!.end;
      setCustomStart(start);
      setCustomEnd(end);
      onChange({ start, end });
      return;
    }
    const preset = presets.find((p) => p.key === key);
    onChange(preset?.range ?? null);
  }

  function handleCustomChange(which: "start" | "end", value: string) {
    const start = which === "start" ? value : customStart;
    const end = which === "end" ? value : customEnd;
    setCustomStart(start);
    setCustomEnd(end);
    if (start && end && start <= end) onChange({ start, end });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Select value={selectedKey} onValueChange={(value) => value && handlePresetChange(value)}>
        <SelectTrigger className="w-40">
          <SelectValue>{(value: string) => presets.find((p) => p.key === value)?.label ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {presets.map((p) => (
            <SelectItem key={p.key} value={p.key}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedKey === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="w-[150px]"
            min={dataDateBounds.start}
            max={dataDateBounds.end}
            value={customStart}
            onChange={(e) => handleCustomChange("start", e.target.value)}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            className="w-[150px]"
            min={dataDateBounds.start}
            max={dataDateBounds.end}
            value={customEnd}
            onChange={(e) => handleCustomChange("end", e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
