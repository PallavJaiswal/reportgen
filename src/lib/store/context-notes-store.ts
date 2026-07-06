import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ContextNote = {
  id: string;
  text: string;
  createdAt: string;
  source: "user" | "ai";
};

type ContextNotesState = {
  notes: ContextNote[];
  addNote: (text: string, source: "user" | "ai") => void;
  removeNote: (id: string) => void;
};

/** Business-context annotations (e.g. "12-15 May was a Prime Day promo") fed
 * into the AI executive summary, Q&A, and anomaly explanations so the model
 * explains trends against real events instead of guessing blindly. Persisted
 * like actionedRecommendations — these should survive across report runs. */
export const useContextNotesStore = create<ContextNotesState>()(
  persist(
    (set) => ({
      notes: [],
      addNote: (text, source) =>
        set((state) => ({
          notes: [
            ...state.notes,
            { id: crypto.randomUUID(), text, createdAt: new Date().toISOString(), source },
          ],
        })),
      removeNote: (id) => set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),
    }),
    { name: "context-notes" }
  )
);
