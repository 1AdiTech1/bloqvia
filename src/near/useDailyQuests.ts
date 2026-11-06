/**
 * Daily quests written by the NEAR AI agent and seeded on chain by the
 * relayer. Everything here is read straight from `core.bloqvia.testnet`
 * (`get_lessons_with_text`): the public text, the rewards, and the model's
 * signature. The answer is only a hash on chain; completing a daily quest
 * goes through the normal `completeLesson` and is verified by the contract.
 *
 *   const { quests, loading } = useDailyQuests();
 *   quests[0].lesson_id        // "daily-2026-11-06"
 *   quests[0].question / options / concept / explanation / near_reveal
 *   quests[0].generated_by     // model, chat id, hashes, signature
 */
import { useEffect, useSyncExternalStore } from "react";
import { views } from "./contracts";
import type { DailyQuest, LessonWithText } from "./types";
import { humanError } from "./errors";

export interface DailyQuestsState {
  quests: DailyQuest[];
  loading: boolean;
  error: string | null;
}
export interface DailyQuestsStore extends DailyQuestsState {
  refresh: () => Promise<void>;
}

const INITIAL: DailyQuestsState = { quests: [], loading: true, error: null };
let state: DailyQuestsState = INITIAL;
let initialised = false;
const listeners = new Set<() => void>();

function set(patch: Partial<DailyQuestsState>): void {
  state = { ...state, ...patch };
  snapshot = build();
  listeners.forEach((l) => l());
}

export function parseDailyQuest(l: LessonWithText): DailyQuest | null {
  if (!l.bonus || !l.text) return null;
  try {
    const t = JSON.parse(l.text) as Omit<DailyQuest, "lesson_id" | "reward_gold" | "reward_item" | "reward_item_amount">;
    return {
      lesson_id: l.lesson.lesson_id,
      reward_gold: l.lesson.reward_gold,
      reward_item: l.lesson.reward_item,
      reward_item_amount: l.lesson.reward_item_amount,
      ...t,
    };
  } catch {
    return null;
  }
}

async function refresh(): Promise<void> {
  try {
    const all = await views.lessonsWithText();
    const quests = all
      .map(parseDailyQuest)
      .filter((q): q is DailyQuest => q !== null)
      .sort((a, b) => (a.lesson_id < b.lesson_id ? 1 : -1)); // newest first
    set({ quests, loading: false, error: null });
  } catch (e) {
    set({ loading: false, error: humanError(e) });
  }
}

const actions = { refresh };
function build(): DailyQuestsStore {
  return { ...state, ...actions };
}
let snapshot: DailyQuestsStore = build();
const SERVER_SNAPSHOT = snapshot;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useDailyQuests(): DailyQuestsStore {
  const value = useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
  useEffect(() => {
    if (initialised) return;
    initialised = true;
    void refresh();
  }, []);
  return value;
}
