import { loadConfig } from "./config.js";
import { startServer } from "./http.js";
import { createNearContext } from "./near.js";
import { startQuestScheduler } from "./quests.js";
import { syncDailyBounty } from "./bounties.js";
import { startSnapshots } from "./market.js";
import { startTrader, tradersState } from "./trader.js";
import { scheduleFastForward, FF_AUTO_HOURS } from "./fastforward.js";
import { startCallSettler } from "./calls.js";

const config = loadConfig();
const ctx = createNearContext(config);
startServer(ctx);
startSnapshots(ctx);
startCallSettler(ctx);
console.log(startTrader(ctx) ? `[relayer] NPC traders on: ${tradersState().map((t) => `${t.temper} (${t.accountId})`).join(", ")}; mind: ${config.ai && process.env.TRADER_MIND !== "rules" ? "NEAR AI agents inside the rules" : "rules only"}` : "[relayer] TRADER_ACCOUNT_ID / TRADER_PRIVATE_KEY not set: NPC traders off");
console.log(scheduleFastForward(ctx) ? `[relayer] fast-forward runs by itself every ${FF_AUTO_HOURS} h` : "[relayer] FF_AUTO_HOURS=0: fast-forward on the button only");
if (config.ai) {
  startQuestScheduler(ctx, config.ai, config.ai.questModel, undefined, () => syncDailyBounty(ctx));
  console.log(`[relayer] daily quest agent on (${config.ai.questModel}); Ask Bloq model ${config.ai.chatModel}`);
} else {
  console.log("[relayer] NEAR_AI_API_KEY not set: daily quest agent off");
}
