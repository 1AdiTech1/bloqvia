import { loadConfig } from "./config.js";
import { startServer } from "./http.js";
import { createNearContext } from "./near.js";
import { startQuestScheduler } from "./quests.js";

const config = loadConfig();
const ctx = createNearContext(config);
startServer(ctx);
if (config.ai) {
  startQuestScheduler(ctx, config.ai, config.ai.questModel);
  console.log(`[relayer] daily quest agent on (${config.ai.questModel}); Ask Bloq model ${config.ai.chatModel}`);
} else {
  console.log("[relayer] NEAR_AI_API_KEY not set: daily quest agent off");
}
