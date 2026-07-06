import { create } from "zustand";
import { persist } from "zustand/middleware";

type ActionTrackingState = {
  actionedRecommendations: string[];
  toggleActioned: (title: string) => void;
  isActioned: (title: string) => boolean;
};

/** Persisted separately from the main report store — recommendation titles
 * marked "actioned" should survive across report runs (closed-loop tracking),
 * unlike the uploaded files / cleaning results which are session-only. */
export const useActionTrackingStore = create<ActionTrackingState>()(
  persist(
    (set, get) => ({
      actionedRecommendations: [],
      toggleActioned: (title) =>
        set((state) => ({
          actionedRecommendations: state.actionedRecommendations.includes(title)
            ? state.actionedRecommendations.filter((t) => t !== title)
            : [...state.actionedRecommendations, title],
        })),
      isActioned: (title) => get().actionedRecommendations.includes(title),
    }),
    { name: "action-tracking" }
  )
);
