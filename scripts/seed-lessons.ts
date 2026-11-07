/**
 * Registers every lesson and Season 2 chapter on bloqvia-core, and stores each
 * chapter's public text on chain (set_lesson_text). Needs the OWNER key (the
 * relayer account). Idempotent: a lesson that already exists is skipped, and a
 * chapter's text is only written when it is missing or different.
 *
 *   OWNER_ACCOUNT_ID=bloqvia.testnet OWNER_PRIVATE_KEY=ed25519:... CORE_CONTRACT_ID=core.bloqvia.testnet npm run seed-lessons
 */
import { Account, JsonRpcProvider, nearToYocto, teraToGas } from "near-api-js";
import type { KeyPairString } from "near-api-js";
import { chapterText, loadChapters, loadLessons, toOnChainLesson } from "./lessons.js";

const rpcUrl = process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com";
const ownerId = process.env.OWNER_ACCOUNT_ID ?? process.env.RELAYER_ACCOUNT_ID;
const ownerKey = (process.env.OWNER_PRIVATE_KEY ?? process.env.RELAYER_PRIVATE_KEY) as KeyPairString | undefined;
const coreId = process.env.CORE_CONTRACT_ID;
if (!ownerId || !ownerKey || !coreId) {
  console.error("Set OWNER_ACCOUNT_ID, OWNER_PRIVATE_KEY and CORE_CONTRACT_ID (or source relayer/.env)");
  process.exit(1);
}

const provider = new JsonRpcProvider({ url: rpcUrl });
const owner = new Account(ownerId, provider, ownerKey);
const existing = (await provider.callFunction({ contractId: coreId, method: "get_lessons", args: {} })) as { lesson_id: string }[];
const have = new Set(existing.map((l) => l.lesson_id));

const chapters = loadChapters();
for (const lesson of [...loadLessons(), ...chapters].map(toOnChainLesson)) {
  if (have.has(lesson.lesson_id)) {
    console.log(`skip ${lesson.lesson_id} (already on-chain; rewards are immutable)`);
    continue;
  }
  await owner.callFunction({ contractId: coreId, methodName: "add_lesson", args: { lesson }, gas: teraToGas("30"), deposit: nearToYocto("0") });
  console.log(`added ${lesson.lesson_id} -> ${lesson.reward_gold} gold + ${lesson.reward_item_amount} ${lesson.reward_item}`);
}

for (const ch of chapters) {
  const text = chapterText(ch);
  const now = (await provider.callFunction({ contractId: coreId, method: "get_lesson_text", args: { lesson_id: ch.lesson_id } })) as string | null;
  if (now === text) {
    console.log(`skip text ${ch.lesson_id} (already on-chain)`);
    continue;
  }
  await owner.callFunction({ contractId: coreId, methodName: "set_lesson_text", args: { lesson_id: ch.lesson_id, text }, gas: teraToGas("30"), deposit: nearToYocto("0") });
  console.log(`text ${ch.lesson_id} -> ${text.length} bytes on chain`);
}
