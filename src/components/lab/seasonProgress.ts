import { LESSON_CONTENT } from "@/game/content";
import { SEASON2_CHAPTERS } from "@/near/useChapters";

const FOUNDING = LESSON_CONTENT.map((lesson) => lesson.lesson_id);

/** Display progress only; completion and stamps are decided by the chain. */
export function seasonProgress(completed: readonly string[]) {
  const foundingDone = completed.filter((id) => FOUNDING.includes(id));
  const chaptersDone = SEASON2_CHAPTERS.filter((id) => completed.includes(id)).length;
  return { foundingDone, chaptersDone, s1Done: foundingDone.length >= 3 };
}