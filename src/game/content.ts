import lessonsJson from "./lessons.json";

export interface LessonContent {
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
}

export const LESSON_CONTENT: LessonContent[] = lessonsJson as LessonContent[];

export const ITEM_IDS = ["key-fragment", "fuel-cell", "contract-seal"] as const;

export const ITEM_NAMES: Record<string, string> = {
  "key-fragment": "Key Fragment",
  "fuel-cell": "Fuel Cell",
  "contract-seal": "Contract Seal",
  gold: "Gold",
};

export function itemAmount(items: [string, string][] | undefined, id: string): number {
  const found = items?.find(([k]) => k === id);
  return found ? Number(found[1]) : 0;
}
