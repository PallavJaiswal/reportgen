export type FlowStep = {
  id: string;
  href: string;
  label: string;
  shortLabel: string;
};

export const FLOW_STEPS: FlowStep[] = [
  { id: "upload", href: "/upload", label: "Upload data", shortLabel: "Upload" },
  { id: "processing", href: "/processing", label: "Clean & validate", shortLabel: "Validate" },
  { id: "insights", href: "/insights", label: "Insights dashboard", shortLabel: "Insights" },
  { id: "summary", href: "/summary", label: "Executive summary", shortLabel: "Summary" },
  { id: "export", href: "/export", label: "Export report", shortLabel: "Export" },
];

export function stepIndex(id: string): number {
  return FLOW_STEPS.findIndex((step) => step.id === id);
}
