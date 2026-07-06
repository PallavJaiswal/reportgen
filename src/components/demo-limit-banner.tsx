import { Sparkles } from "lucide-react";

export function DemoLimitBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2.5">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
      <p className="text-xs leading-relaxed text-foreground">{message}</p>
    </div>
  );
}
