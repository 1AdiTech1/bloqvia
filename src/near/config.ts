/// <reference types="vite/client" />
/**
 * Chain configuration for the web app. Every value can be overridden with a
 * VITE_* variable; the defaults are the testnet deployment.
 */
export const NEAR_CONFIG = {
  network: (import.meta.env.VITE_NEAR_NETWORK ?? "testnet") as "testnet" | "mainnet",
  rpcUrl: import.meta.env.VITE_NEAR_RPC_URL ?? "https://test.rpc.fastnear.com",
  coreContractId: import.meta.env.VITE_CORE_CONTRACT_ID ?? "core.bloqvia.testnet",
  passportContractId: import.meta.env.VITE_PASSPORT_CONTRACT_ID ?? "passport.bloqvia.testnet",
  relayerUrl: (import.meta.env.VITE_RELAYER_URL ?? "https://relay.bloqvia.app").replace(/\/$/, ""),
  explorerBase: import.meta.env.VITE_EXPLORER_BASE ?? "https://testnet.nearblocks.io",
} as const;

/** Token ids, mirrored from contracts/bloqvia-core/src/lib.rs. */
export const GOLD = "gold";
export const ITEMS = ["key-fragment", "fuel-cell", "contract-seal"] as const;
export type ItemId = (typeof ITEMS)[number];

/** Gas attached to every learner call (graduate needs ~25; the relayer caps at 50). */
export const CALL_GAS_TGAS = "40";
/** Blocks a signed delegate stays valid (~1 block/second). */
export const DELEGATE_TTL_BLOCKS = 100;
