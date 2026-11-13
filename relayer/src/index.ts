import { loadConfig } from "./config.js";
import { startServer } from "./http.js";
import { createNearContext } from "./near.js";
import { startQuestScheduler } from "./quests.js";
import { syncDailyBounty } from "./bounties.js";
import { startSnapshots } from "./market.js";
import { startTrader, tradersState } from "./trader.js";
import { scheduleFastForward, FF_AUTO_HOURS } from "./fastforward.js";
import { startCallSettler } from "./calls.js";
import { Desk } from "./desk.js";
import { setDesk } from "./http.js";
import { pursesFromEnv } from "./purse.js";

const config = loadConfig();
const ctx = createNearContext(config);
startServer(ctx);
startSnapshots(ctx);
startCallSettler(ctx);
let purses: ReturnType<typeof pursesFromEnv> = [];
if (config.desk) {
  const desk = new Desk({ network: config.network, rpcUrl: config.rpcUrl, payTo: config.desk.payTo, relayerAccountId: config.relayerAccountId, relayerPrivateKey: config.relayerPrivateKey, asset: config.desk.wnear }, config.desk.publicUrl);
  setDesk(desk);
  purses = pursesFromEnv(process.env, { rpcUrl: config.rpcUrl, network: config.network, allowedHosts: [new URL(config.desk.publicUrl).host] });
  console.log(`[relayer] market desk on at ${config.desk.publicUrl}: /desk/signal and /passport/proof paid in ${config.desk.wnear} to ${config.desk.payTo} (x402); purses: ${purses.map((p) => p?.accountId ?? "none").join(", ")}`);
} else {
  console.log("[relayer] DESK=off: the market desk and the purses are off");
}
console.log(startTrader(ctx, process.env, purses, config.desk?.publicUrl ?? null) ? `[relayer] NPC traders on: ${tradersState().map((t) => `${t.temper} (${t.accountId})`).join(", ")}; mind: ${config.ai && process.env.TRADER_MIND !== "rules" ? "NEAR AI agents inside the rules" : "rules only"}` : "[relayer] TRADER_ACCOUNT_ID / TRADER_PRIVATE_KEY not set: NPC traders off");
console.log(scheduleFastForward(ctx) ? `[relayer] fast-forward runs by itself every ${FF_AUTO_HOURS} h` : "[relayer] FF_AUTO_HOURS=0: fast-forward on the button only");
if (config.ai) {
  startQuestScheduler(ctx, config.ai, config.ai.questModel, undefined, () => syncDailyBounty(ctx));
  console.log(`[relayer] daily quest agent on (${config.ai.questModel}); Ask Bloq model ${config.ai.chatModel}`);
} else {
  console.log("[relayer] NEAR_AI_API_KEY not set: daily quest agent off");
}
