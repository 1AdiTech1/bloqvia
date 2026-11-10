import { loadConfig } from "./config.js";
import { startServer } from "./http.js";
import { createNearContext } from "./near.js";
import { startQuestScheduler } from "./quests.js";
import { syncDailyBounty } from "./bounties.js";
import { startSnapshots } from "./market.js";
import { startTrader } from "./trader.js";

const config = loadConfig();
const ctx = createNearContext(config);
startServer(ctx);
startSnapshots(ctx);
console.log(startTrader(ctx) ? `[relayer] NPC trader on (${process.env.TRADER_ACCOUNT_ID})` : "[relayer] TRADER_ACCOUNT_ID / TRADER_PRIVATE_KEY not set: NPC trader off");
if (config.ai) {
  startQuestScheduler(ctx, config.ai, config.ai.questModel, undefined, () => syncDailyBounty(ctx));
  console.log(`[relayer] daily quest agent on (${config.ai.questModel}); Ask Bloq model ${config.ai.chatModel}`);
} else {
  console.log("[relayer] NEAR_AI_API_KEY not set: daily quest agent off");
}
