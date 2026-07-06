"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, X } from "lucide-react";
import { cn } from "@/lib/utils";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDropzone({
  label,
  description,
  required = false,
  file,
  onChange,
}: {
  label: string;
  description: string;
  required?: boolean;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | null) {
    const picked = fileList?.[0];
    if (!picked) return;
    onChange(picked);
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border border-dashed p-5 transition-colors",
        isDragging ? "border-brand bg-brand/5" : "border-border hover:border-foreground/30",
        file && "border-solid border-border bg-card"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xls,.xlsx"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-1 flex-col items-center gap-3 py-4 text-center"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:text-foreground">
            <UploadCloud className="h-5 w-5" />
          </span>
          <span className="space-y-1">
            <span className="flex items-center justify-center gap-1.5 text-sm font-medium">
              {label}
              {required && <span className="text-brand">*</span>}
            </span>
            <span className="block text-xs text-muted-foreground">
              {description}
            </span>
          </span>
          <span className="text-xs text-muted-foreground/70">
            Drag & drop or click to browse (CSV, XLS, XLSX)
          </span>
        </button>
      ) : (
        <div className="flex flex-1 items-center gap-3 py-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{label}</p>
            <p className="truncate text-xs text-muted-foreground">
              {file.name} · {formatSize(file.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Remove ${label} file`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
