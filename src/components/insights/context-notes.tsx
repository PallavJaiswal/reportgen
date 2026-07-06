"use client";

import { useState } from "react";
import { Lightbulb, Loader2, Sparkles, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useContextNotesStore } from "@/lib/store/context-notes-store";
import { useActionTrackingStore } from "@/lib/store/action-tracking-store";
import { buildReportContext } from "@/lib/ai/build-report-context";
import { requestAnswer } from "@/lib/ai/client";
import type { useReportAnalytics } from "@/lib/analytics/use-report-analytics";

const SUGGEST_PROMPT =
  "Looking at the KPI trends, anomalies, and top/bottom performers in this data, suggest up to 3 short, plausible business reasons (a promotion, price change, stockout, seasonal effect, etc.) that could explain the most notable patterns. Phrase each as a hypothesis for the user to confirm or correct — not as a certain fact. Return each suggestion on its own line, no numbering, no markdown.";

type Analytics = ReturnType<typeof useReportAnalytics>;

export function ContextNotes({ analytics }: { analytics: Analytics }) {
  const notes = useContextNotesStore((s) => s.notes);
  const addNote = useContextNotesStore((s) => s.addNote);
  const removeNote = useContextNotesStore((s) => s.removeNote);
  const actionedRecommendations = useActionTrackingStore((s) => s.actionedRecommendations);

  const [draft, setDraft] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAddNote() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    addNote(trimmed, "user");
    setDraft("");
  }

  async function handleSuggest() {
    setSuggesting(true);
    setError(null);
    try {
      const context = buildReportContext({
        periodLabel: analytics.periodLabel,
        comparisonLabel: analytics.comparisonLabel,
        kpiRows: analytics.kpiTrends.rows,
        anomalies: analytics.anomalies,
        skuPerformers: analytics.performers.sku,
        risks: analytics.risks,
        actionedRecommendations,
        reportingCurrency: analytics.effectiveCurrency,
        contextNotes: notes.map((n) => n.text),
      });
      const result = await requestAnswer(SUGGEST_PROMPT, context);
      const suggestions = result.answer
        .split("\n")
        .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
        .filter(Boolean);
      for (const suggestion of suggestions) addNote(suggestion, "ai");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get AI suggestions.");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-brand" />
          Business context
        </CardTitle>
        <CardDescription>
          Add anything the AI should know — a promotion, a price change, an outage — and it&apos;ll be woven
          into the executive summary, Q&amp;A, and anomaly explanations. Or let the AI guess from the data itself.
          Want AI&apos;s take on something specific instead? Ask it directly in the{" "}
          <span className="font-medium text-foreground">Ask a question</span> tab below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notes.length > 0 && (
          <div className="space-y-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-border p-2.5"
              >
                <div className="flex items-start gap-2">
                  {note.source === "ai" && (
                    <Badge variant="secondary" className="mt-0.5 shrink-0 gap-1 text-[10px]">
                      <Sparkles className="h-2.5 w-2.5" />
                      AI guess
                    </Badge>
                  )}
                  <p className="text-sm leading-relaxed">{note.text}</p>
                </div>
                <button
                  onClick={() => removeNote(note.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Remove note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <Textarea
            placeholder='e.g. "12-15 May 2026 was a Prime Day promotion storewide"'
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddNote} disabled={!draft.trim()}>
              Add context
            </Button>
            <Button size="sm" variant="outline" onClick={handleSuggest} disabled={suggesting} className="gap-2">
              {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Suggest with AI
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
