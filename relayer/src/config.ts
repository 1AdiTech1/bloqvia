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
    passportContractId: required("PASSPORT_CONTRACT_ID"),
    learnerFundingNear: env.LEARNER_FUNDING_NEAR ?? "0.01",
    corsOrigins: (env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean),
    port: Number(env.PORT ?? 8787),
  };
}
