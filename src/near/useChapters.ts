/**
 * Season 2 chapters, read from `core.bloqvia.testnet` (`get_lessons_with_text`).
 * They are bonus quests with `chapter-` ids: each pays gold and an item and
 * never changes the Passport level. Completing the third one makes the core
 * contract stamp the Passport with "season-2" in the same transaction.
 *
 *   const { chapters, loading } = useChapters();
 *   chapters.map((c) => c.lesson_id)  // in SEASON2_CHAPTERS order
 *   season2Done(passport)             // true once the stamp is on the Passport
 */
import { useEffect, useSyncExternalStore } from "react";
import { views } from "./contracts";
import type { Chapter, LessonWithText, PassportView } from "./types";
import { humanError } from "./errors";

/** Map order; the same list is hard-coded in the core contract. */
export const SEASON2_CHAPTERS = ["chapter-ownership", "chapter-transactions", "chapter-defi"] as const;
export type ChapterId = (typeof SEASON2_CHAPTERS)[number];
export const SEASON2_STAMP = "season-2";

export const season2Done = (p: PassportView | null | undefined): boolean =>
  !!p?.stamps?.includes(SEASON2_STAMP);

export interface ChaptersState {
  chapters: Chapter[];
  loading: boolean;
  error: string | null;
}
export interface ChaptersStore extends ChaptersState {
  refresh: () => Promise<void>;
}

const INITIAL: ChaptersState = { chapters: [], loading: true, error: null };
let state: ChaptersState = INITIAL;
let initialised = false;
const listeners = new Set<() => void>();

function set(patch: Partial<ChaptersState>): void {
  state = { ...state, ...patch };
  snapshot = build();
  listeners.forEach((l) => l());
}

export function parseChapter(l: LessonWithText): Chapter | null {
  const id = l.lesson.lesson_id;
  if (!l.bonus || !l.text || !(SEASON2_CHAPTERS as readonly string[]).includes(id)) return null;
  try {
    const t = JSON.parse(l.text) as Omit<Chapter, "lesson_id" | "reward_gold" | "reward_item" | "reward_item_amount">;
    return {
      ...t,
      lesson_id: id,
      reward_gold: l.lesson.reward_gold,
      reward_item: l.lesson.reward_item,
      reward_item_amount: l.lesson.reward_item_amount,
    };
  } catch {
    return null;
  }
}

async function refresh(): Promise<void> {
  try {
    const all = await views.lessonsWithText();
    const order = (id: string) => (SEASON2_CHAPTERS as readonly string[]).indexOf(id);
    const chapters = all
      .map(parseChapter)
      .filter((c): c is Chapter => c !== null)
      .sort((a, b) => order(a.lesson_id) - order(b.lesson_id));
    set({ chapters, loading: false, error: null });
  } catch (e) {
    set({ loading: false, error: humanError(e) });
  }
}

const actions = { refresh };
function build(): ChaptersStore {
  return { ...state, ...actions };
}
let snapshot: ChaptersStore = build();
const SERVER_SNAPSHOT = snapshot;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useChapters(): ChaptersStore {
  const value = useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
  useEffect(() => {
    if (initialised) return;
    initialised = true;
    void refresh();
  }, []);
  return value;
}
