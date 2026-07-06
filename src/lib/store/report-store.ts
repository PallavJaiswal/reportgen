import { create } from "zustand";
import type { CleaningResult } from "@/lib/data/clean-dataset";
import type { ExecutiveSummaryResult } from "@/lib/ai/types";
import type { DateRange } from "@/lib/stats/date-range";

export type DatasetKey = "sales" | "orders" | "inventory" | "returns";

export type PipelineStatus = "idle" | "processing" | "done" | "error";

type ReportState = {
  files: Record<DatasetKey, File | null>;
  cleaningResults: Partial<Record<DatasetKey, CleaningResult>>;
  status: PipelineStatus;
  error: string | null;
  executiveSummary: ExecutiveSummaryResult | null;
  /** The currency the whole report (KPIs, anomalies, performers, AI summary,
   * exports) is currently scoped to. Null means "not chosen yet" — the
   * analytics layer falls back to the dataset's majority currency so
   * figures are never blended across currencies. */
  selectedCurrency: string | null;
  /** The reporting window every KPI, performer ranking, and export is
   * scoped to. Null means "all time" — the full uploaded history. */
  dateRange: DateRange | null;
  /** Narrows the whole dashboard to one sales channel. Null means "all
   * channels combined" — unlike currency, channels can be validly summed
   * together, so there's no forced default the way there is for currency. */
  selectedChannel: string | null;
  setFile: (key: DatasetKey, file: File | null) => void;
  setFiles: (files: Partial<Record<DatasetKey, File | null>>) => void;
  setCleaningResults: (results: Partial<Record<DatasetKey, CleaningResult>>) => void;
  setStatus: (status: PipelineStatus, error?: string | null) => void;
  setExecutiveSummary: (summary: ExecutiveSummaryResult | null) => void;
  setSelectedCurrency: (currency: string | null) => void;
  setDateRange: (range: DateRange | null) => void;
  setSelectedChannel: (channel: string | null) => void;
  reset: () => void;
};

const EMPTY_FILES: Record<DatasetKey, File | null> = {
  sales: null,
  orders: null,
  inventory: null,
  returns: null,
};

export const useReportStore = create<ReportState>((set) => ({
  files: { ...EMPTY_FILES },
  cleaningResults: {},
  status: "idle",
  error: null,
  executiveSummary: null,
  selectedCurrency: null,
  dateRange: null,
  selectedChannel: null,
  setFile: (key, file) =>
    set((state) => ({ files: { ...state.files, [key]: file } })),
  setFiles: (files) =>
    set((state) => ({ files: { ...state.files, ...files } })),
  setCleaningResults: (results) =>
    set((state) => ({ cleaningResults: { ...state.cleaningResults, ...results } })),
  setStatus: (status, error = null) => set({ status, error }),
  setExecutiveSummary: (summary) => set({ executiveSummary: summary }),
  setSelectedCurrency: (currency) => set({ selectedCurrency: currency }),
  setDateRange: (range) => set({ dateRange: range }),
  setSelectedChannel: (channel) => set({ selectedChannel: channel }),
  reset: () =>
    set({
      files: { ...EMPTY_FILES },
      cleaningResults: {},
      status: "idle",
      error: null,
      executiveSummary: null,
      selectedCurrency: null,
      dateRange: null,
      selectedChannel: null,
    }),
}));
