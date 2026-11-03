/**
 * Derives src/content/lessons.public.json (what the web app ships: no answers,
 * but the hash) and prints the add_lesson payloads for seed-lessons.ts.
 *
 *   npm run hash-lessons
 */
import { writeFileSync } from "node:fs";
import { LESSONS_PUBLIC, loadLessons, toOnChainLesson } from "./lessons.js";

const lessons = loadLessons();
const publicLessons = lessons.map(({ answer, ...rest }) => ({ ...rest, answer_hash: toOnChainLesson({ ...rest, answer }).answer_hash }));
writeFileSync(LESSONS_PUBLIC, JSON.stringify({ lessons: publicLessons }, null, 2) + "\n");
console.log(`wrote ${LESSONS_PUBLIC} (${publicLessons.length} lessons, answers stripped)`);
for (const l of lessons) console.log(JSON.stringify(toOnChainLesson(l)));
