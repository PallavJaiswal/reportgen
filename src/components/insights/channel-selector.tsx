"use client";

import { Radio } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_CHANNELS = "__all__";

export function ChannelSelector({
  availableChannels,
  selectedChannel,
  onChange,
}: {
  availableChannels: string[];
  selectedChannel: string | null;
  onChange: (channel: string | null) => void;
}) {
  if (availableChannels.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <Radio className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Select
        value={selectedChannel ?? ALL_CHANNELS}
        onValueChange={(value) => onChange(value === ALL_CHANNELS ? null : value)}
      >
        <SelectTrigger className="w-40">
          <SelectValue>
            {(value: string) => (value === ALL_CHANNELS ? "All channels" : value)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CHANNELS}>All channels</SelectItem>
          {availableChannels.map((channel) => (
            <SelectItem key={channel} value={channel}>
              {channel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
