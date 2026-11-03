import { NEAR_CONFIG } from "./config";

export const explorer = {
  tx: (hash: string) => `${NEAR_CONFIG.explorerBase}/txns/${hash}`,
  account: (accountId: string) => `${NEAR_CONFIG.explorerBase}/address/${accountId}`,
  passport: (accountId: string) =>
    `${NEAR_CONFIG.explorerBase}/nft-token/${NEAR_CONFIG.passportContractId}/${accountId}`,
};
