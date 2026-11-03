/** Browser twin of relayer/src/codec.ts: SignedDelegate -> base64 (borsh bytes). */
import { encodeSignedDelegate } from "near-api-js";
import type { SignedDelegate } from "near-api-js";

export function encodeSignedDelegateBase64(signedDelegate: SignedDelegate): string {
  const bytes = encodeSignedDelegate(signedDelegate);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
