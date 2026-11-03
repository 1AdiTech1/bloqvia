import { loadConfig } from "./config.js";
import { startServer } from "./http.js";
import { createNearContext } from "./near.js";

const config = loadConfig();
const ctx = createNearContext(config);
startServer(ctx);
