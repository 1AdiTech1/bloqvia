/** Environment-driven configuration. Fails fast on a missing secret. */
export interface RelayerConfig {
  network: "testnet" | "mainnet";
  rpcUrl: string;
  relayerAccountId: string;
  relayerPrivateKey: `ed25519:${string}` | `secp256k1:${string}`;
  coreContractId: string;
  passportContractId: string;
  learnerFundingNear: string;
  corsOrigins: string[];
  port: number;
  /** NEAR AI Cloud (optional). Without a key the daily quest and Ask Bloq are off. */
  ai: { apiKey: string; baseUrl: string; questModel: string; chatModel: string; askDailyCap: number } | null;
  /** Shared secret for POST /admin/*; without it those routes are off. */
  adminToken: string | null;
  /** The cohort's Sputnik DAO (Module B): seats for graduates and founders, votes relayed to it (seats.ts). */
  daoId: string;
  /** Abuse limits (Nov 11): registrations per IP per hour, registrations per UTC day, relays per IP per minute. */
  limits: { registerPerIpPerHour: number; registerPerDay: number; relayPerIpPerMin: number };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing required env var ${name}`);
  return v.trim();
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RelayerConfig {
  const network = (env.NEAR_NETWORK ?? "testnet") as RelayerConfig["network"];
  if (network !== "testnet" && network !== "mainnet") {
    throw new Error(`NEAR_NETWORK must be testnet or mainnet, got ${network}`);
  }
  const privateKey = required("RELAYER_PRIVATE_KEY");
  if (!privateKey.startsWith("ed25519:") && !privateKey.startsWith("secp256k1:")) {
    throw new Error("RELAYER_PRIVATE_KEY must look like ed25519:... (a full-access key)");
  }
  return {
    network,
    rpcUrl: env.NEAR_RPC_URL ?? (network === "testnet" ? "https://test.rpc.fastnear.com" : "https://free.rpc.fastnear.com"),
    relayerAccountId: required("RELAYER_ACCOUNT_ID"),
    relayerPrivateKey: privateKey as RelayerConfig["relayerPrivateKey"],
    coreContractId: required("CORE_CONTRACT_ID"),
    daoId: env.DAO_ID?.trim() || "bloqvia-dao.sputnik-v2.testnet",
    passportContractId: required("PASSPORT_CONTRACT_ID"),
    learnerFundingNear: env.LEARNER_FUNDING_NEAR ?? "0.01",
    corsOrigins: (env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean),
    port: Number(env.PORT ?? 8787),
    ai: env.NEAR_AI_API_KEY?.trim()
      ? {
          apiKey: env.NEAR_AI_API_KEY.trim(),
          baseUrl: (env.NEAR_AI_BASE_URL ?? "https://cloud-api.near.ai/v1").replace(/\/$/, ""),
          questModel: env.NEAR_AI_MODEL_QUEST ?? "Qwen/Qwen3.6-35B-A3B-FP8",
          chatModel: env.NEAR_AI_MODEL_CHAT ?? "z-ai/glm-5.3-flash",
          askDailyCap: Number(env.ASK_DAILY_CAP ?? 400),
        }
      : null,
    adminToken: env.ADMIN_TOKEN?.trim() || null,
    limits: {
      registerPerIpPerHour: Number(env.REGISTER_PER_IP_PER_HOUR ?? 6),
      registerPerDay: Number(env.REGISTER_PER_DAY ?? 400),
      relayPerIpPerMin: Number(env.RELAY_PER_IP_PER_MIN ?? 120),
    },
  };
}
