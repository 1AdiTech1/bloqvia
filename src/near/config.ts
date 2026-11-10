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
  /** Module A. The card hides itself when core reports no streak contract. */
  streakContractId: import.meta.env.VITE_STREAK_CONTRACT_ID ?? "streak.bloqvia.testnet",
  /** Module B's cohort DAO; the Passport's second key votes there (Nov 10). */
  daoId: import.meta.env.VITE_DAO_ID ?? "bloqvia-dao.sputnik-v2.testnet",
  relayerUrl: (import.meta.env.VITE_RELAYER_URL ?? "https://relay.bloqvia.app").replace(/\/$/, ""),
  explorerBase: import.meta.env.VITE_EXPLORER_BASE ?? "https://testnet.nearblocks.io",
} as const;

/** Token ids, mirrored from contracts/bloqvia-core/src/lib.rs. */
export const GOLD = "gold";
export const ITEMS = ["key-fragment", "fuel-cell", "contract-seal"] as const;
export type ItemId = (typeof ITEMS)[number];

/** Gas attached to every learner call (graduate needs ~25; the relayer caps at 150). */
export const CALL_GAS_TGAS = "40";
/** claim_bounty: core → board → core.get_learner → pay or DAO add_proposal → callback. */
export const CLAIM_GAS_TGAS = "140";
/** A vote on the DAO: act_proposal runs the proposal's own action when it passes (a Transfer, a FunctionCall). */
export const VOTE_GAS_TGAS = "120";
/** Blocks a signed delegate stays valid (~1 block/second). */
export const DELEGATE_TTL_BLOCKS = 100;
