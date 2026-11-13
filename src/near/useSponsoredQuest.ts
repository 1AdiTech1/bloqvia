/**
 * The day's sponsored quest (Nov 14): one slot a day on the map, sold per request over x402 (relayer/src/sponsor.ts).
 * Read straight from `core.bloqvia.testnet` like the daily quest: the lesson is `daily-<date>-sponsored`, a bonus quest
 * for the contract (50 gold, one item, no Passport level), and its public text carries the sponsor's name, the slot's
 * payment (who paid, how much, the transaction) and who checked it. The answer is only a hash on chain; playing it is
 * the normal `completeLesson`, verified by the contract.
 *
 *   const { quest, done, loading } = useSponsoredQuest(learner.completed);
 *   quest?.sponsor.name          // "Beacon Bridge", or "Bloqvia" when the house bought the slot (quest.sponsor.house)
 *   quest?.slot.tx_hash          // the payment on the explorer
 *   quest === null               // no slot bought today (the card is not shown)
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { views } from "./contracts";
import type { LessonWithText, SponsoredQuest } from "./types";
import { humanError } from "./errors";

export const SPONSOR_SUFFIX = "-sponsored";
export function sponsoredLessonId(date = new Date()): string {
  return `daily-${date.toISOString().slice(0, 10)}${SPONSOR_SUFFIX}`;
}

export interface SponsoredQuestState {
  /** every sponsored quest on chain, newest first */
  quests: SponsoredQuest[];
  loading: boolean;
  error: string | null;
}
export interface SponsoredQuestStore extends SponsoredQuestState {
  /** today's slot, or null when nobody bought it */
  quest: SponsoredQuest | null;
  /** today's slot is played by this learner (from `learner.completed`) */
  done: boolean;
  refresh: () => Promise<void>;
}

const INITIAL: SponsoredQuestState = { quests: [], loading: true, error: null };
let state: SponsoredQuestState = INITIAL;
let initialised = false;
const listeners = new Set<() => void>();

function set(patch: Partial<SponsoredQuestState>): void {
  state = { ...state, ...patch };
  snapshot = { ...state };
  listeners.forEach((l) => l());
}

export function parseSponsoredQuest(l: LessonWithText): SponsoredQuest | null {
  if (!l.bonus || !l.text || !l.lesson.lesson_id.startsWith("daily-") || !l.lesson.lesson_id.endsWith(SPONSOR_SUFFIX)) return null;
  try {
    const t = JSON.parse(l.text) as Omit<SponsoredQuest, "lesson_id" | "reward_gold" | "reward_item" | "reward_item_amount">;
    if (!t.sponsor || !t.slot) return null;
    return { lesson_id: l.lesson.lesson_id, reward_gold: l.lesson.reward_gold, reward_item: l.lesson.reward_item, reward_item_amount: l.lesson.reward_item_amount, ...t };
  } catch {
    return null;
  }
}

async function refresh(): Promise<void> {
  try {
    const all = await views.lessonsWithText();
    const quests = all.map(parseSponsoredQuest).filter((q): q is SponsoredQuest => q !== null).sort((a, b) => (a.lesson_id < b.lesson_id ? 1 : -1));
    set({ quests, loading: false, error: null });
  } catch (e) {
    set({ loading: false, error: humanError(e) });
  }
}

let snapshot: SponsoredQuestState = { ...state };
const SERVER_SNAPSHOT = snapshot;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useSponsoredQuest(completed: readonly string[] = []): SponsoredQuestStore {
  const value = useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
  useEffect(() => {
    if (initialised) return;
    initialised = true;
    void refresh();
  }, []);
  const todayId = sponsoredLessonId();
  const quest = useMemo(() => value.quests.find((q) => q.lesson_id === todayId) ?? null, [value.quests, todayId]);
  const done = quest !== null && completed.includes(quest.lesson_id);
  return { ...value, quest, done, refresh };
}
