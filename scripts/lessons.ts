/** Shared loader + the hash function that MUST match contracts/bloqvia-core/src/lib.rs::answer_hash. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export interface LessonSource {
  lesson_id: string;
  title: string;
  topic: string;
  concept: string;
  question: string;
  options: string[];
  answer: string;
  reward_gold: string;
  reward_item: string;
  reward_item_amount: string;
  success: string;
  near_reveal: string;
  /** Shown inside the quiz after a wrong answer. Never affects rewards. */
  explanation?: string;
}

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const LESSONS_SRC = resolve(ROOT, "src/content/lessons.json");
export const LESSONS_PUBLIC = resolve(ROOT, "src/content/lessons.public.json");

/** hex(sha256("{lesson_id}|{answer.trim().toLowerCase()}")) — same as the contract. */
export function answerHash(lessonId: string, answer: string): string {
  return createHash("sha256").update(`${lessonId}|${answer.trim().toLowerCase()}`).digest("hex");
}

export function loadLessons(): LessonSource[] {
  const json = JSON.parse(readFileSync(LESSONS_SRC, "utf8")) as { lessons: LessonSource[] };
  return json.lessons;
}

/** The exact JSON `add_lesson` takes. */
export function toOnChainLesson(l: LessonSource) {
  return {
    lesson_id: l.lesson_id,
    title: l.title,
    answer_hash: answerHash(l.lesson_id, l.answer),
    reward_gold: l.reward_gold,
    reward_item: l.reward_item,
    reward_item_amount: l.reward_item_amount,
  };
}
