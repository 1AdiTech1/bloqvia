/**
 * After Season 2: what is left to do today, worked out from the chain, and where Bloq goes next.
 * Approved in docs/design/after-seasons (Nov 8).
 *
 *   const after = useAfterSeasons({ accountId, stamped, completed });
 *   after.active        // the Passport has the Season 2 stamp (otherwise nothing shows)
 *   after.ready         // the streak and today's quest have loaded, so `next` won't jump around
 *   after.next          // "streak" | "daily" | "sponsored" | "missions" | "done": the card Bloq sits on now
 *   after.streak / after.daily / after.sponsored / after.missions   // { available, done } for the list card's rows
 *   after.tourStarted   // Bloq has already left Network City for this account (remembered in this browser)
 *   after.startTour()   // call when he jumps out of Network City
 *
 *   markMissionsSeen(accountId)   // the Missions page calls this when it opens
 *
 * Streak: done when the chain says this account checked in this Bloqvia day (10 minutes on testnet).
 * Today's quest: done when the newest daily quest is in `completed`. The sponsored quest (Nov 14): done when today's
 * sponsored slot is in `completed`; not available on a day nobody bought the slot. Missions: done once the Missions page
 * was opened. A line whose feature is off (no streak contract, no daily quest) is not available and skipped.
 * The streak and the quest come back by themselves each new day, so the tour does too.
 */
import { useCallback, useEffect, useState } from "react";
import { useStreak } from "./useStreak";
import { useDailyQuests } from "./useDailyQuests";
import { useSponsoredQuest } from "./useSponsoredQuest";

export type AfterStep = "streak" | "daily" | "sponsored" | "missions" | "done";
export interface AfterItem { available: boolean; done: boolean }
export interface AfterSeasons {
  active: boolean;
  ready: boolean;
  next: AfterStep;
  streak: AfterItem;
  daily: AfterItem & { lessonId: string | null };
  sponsored: AfterItem & { lessonId: string | null };
  missions: AfterItem;
  tourStarted: boolean;
  startTour: () => void;
}

const SEEN_EVENT = "bloqvia:after";
const keyFor = (kind: "missions" | "tour", accountId: string) => `bloqvia:after:${kind}:${accountId}`;
function read(key: string): boolean {
  try { return localStorage.getItem(key) === "1"; } catch { return false; }
}
function write(key: string): void {
  try { localStorage.setItem(key, "1"); } catch { /* kept for this visit only */ }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SEEN_EVENT));
}

/** The Missions page calls this when it opens. */
export function markMissionsSeen(accountId: string | null | undefined): void {
  if (accountId) write(keyFor("missions", accountId));
}

export function useAfterSeasons({ accountId, stamped, completed }: { accountId: string | null | undefined; stamped: boolean; completed: readonly string[] }): AfterSeasons {
  const streak = useStreak();
  const daily = useDailyQuests();
  const sponsored = useSponsoredQuest(completed);
  const [flags, setFlags] = useState({ missions: false, tour: false });

  useEffect(() => {
    const sync = () => setFlags(accountId ? { missions: read(keyFor("missions", accountId)), tour: read(keyFor("tour", accountId)) } : { missions: false, tour: false });
    sync();
    window.addEventListener(SEEN_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(SEEN_EVENT, sync); window.removeEventListener("storage", sync); };
  }, [accountId]);

  const startTour = useCallback(() => {
    if (accountId) write(keyFor("tour", accountId));
    else setFlags((f) => ({ ...f, tour: true }));
  }, [accountId]);

  const quest = daily.error ? undefined : daily.quests[0];
  const s: AfterItem = { available: streak.enabled && !!streak.streak, done: !!streak.member?.checked_in_today };
  const d = { available: !!quest, done: !!quest && completed.includes(quest.lesson_id), lessonId: quest?.lesson_id ?? null };
  const sp = { available: !sponsored.error && sponsored.quest !== null, done: sponsored.done, lessonId: sponsored.quest?.lesson_id ?? null };
  const m: AfterItem = { available: true, done: flags.missions };
  const next: AfterStep = s.available && !s.done ? "streak" : d.available && !d.done ? "daily" : sp.available && !sp.done ? "sponsored" : !m.done ? "missions" : "done";

  return {
    active: stamped,
    ready: streak.loaded && !daily.loading && !sponsored.loading,
    next,
    streak: s,
    daily: d,
    sponsored: sp,
    missions: m,
    tourStarted: flags.tour,
    startTour,
  };
}
