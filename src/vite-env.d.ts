/// <reference types="vite/client" />

/**
 * Named typings for the VITE_* variables the app reads. Declaring them here
 * keeps dot access valid under noPropertyAccessFromIndexSignature.
 */
interface ImportMetaEnv {
  readonly VITE_GAME_MODE?: string;
  readonly VITE_SIGNER_KIND?: string;
  readonly VITE_NEAR_NETWORK?: string;
  readonly VITE_NEAR_RPC_URL?: string;
  readonly VITE_CORE_CONTRACT_ID?: string;
  readonly VITE_PASSPORT_CONTRACT_ID?: string;
  readonly VITE_RELAYER_URL?: string;
  readonly VITE_EXPLORER_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
