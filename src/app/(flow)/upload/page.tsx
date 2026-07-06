"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlowProgress } from "@/components/flow-progress";
import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { useReportStore, type DatasetKey } from "@/lib/store/report-store";

const DATASETS: Array<{
  key: DatasetKey;
  label: string;
  description: string;
  required?: boolean;
  sampleUrl: string;
}> = [
  {
    key: "sales",
    label: "Sales",
    description: "Line-item revenue by SKU, date, region",
    required: true,
    sampleUrl: "/sample-data/sample-sales.csv",
  },
  {
    key: "orders",
    label: "Orders",
    description: "Order-level status, fulfillment, channel",
    sampleUrl: "/sample-data/sample-orders.csv",
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "On-hand units, reorder points, warehouse",
    sampleUrl: "/sample-data/sample-inventory.csv",
  },
  {
    key: "returns",
    label: "Returns",
    description: "Returned units, reasons, refund amounts",
    sampleUrl: "/sample-data/sample-returns.csv",
  },
];

export default function UploadPage() {
  const router = useRouter();
  const files = useReportStore((s) => s.files);
  const setFile = useReportStore((s) => s.setFile);
  const setFiles = useReportStore((s) => s.setFiles);
  const [loadingSample, setLoadingSample] = useState(false);

  const canContinue = files.sales !== null;

  async function loadSampleData() {
    setLoadingSample(true);
    try {
      const entries = await Promise.all(
        DATASETS.map(async (dataset) => {
          const res = await fetch(dataset.sampleUrl);
          const blob = await res.blob();
          const file = new File([blob], dataset.sampleUrl.split("/").pop()!, {
            type: "text/csv",
          });
          return [dataset.key, file] as const;
        })
      );
      setFiles(Object.fromEntries(entries));
    } finally {
      setLoadingSample(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <FlowProgress current="upload" />

      <div className="mt-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">
            Upload your data
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Add your Sales, Orders, Inventory, and Returns exports. Sales is
            required — the rest sharpen root-cause drill-downs and
            cross-checks. Files stay in this session and are never stored
            server-side.
          </p>
        </div>
        <Button
          variant="outline"
          className="shrink-0 gap-2"
          disabled={loadingSample}
          onClick={loadSampleData}
        >
          {loadingSample ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Try with sample data
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {DATASETS.map((dataset) => (
          <FileDropzone
            key={dataset.key}
            label={dataset.label}
            description={dataset.description}
            required={dataset.required}
            file={files[dataset.key]}
            onChange={(file) => setFile(dataset.key, file)}
          />
        ))}
      </div>

      <div className="mt-8 flex flex-col-reverse items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          Processed in-memory for this session only — never stored server-side.
        </div>
        <Button
          size="lg"
          disabled={!canContinue}
          onClick={() => router.push("/processing")}
          className="gap-2"
        >
          Continue to validation
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
