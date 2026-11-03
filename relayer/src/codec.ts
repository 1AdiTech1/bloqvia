/**
 * Wire format for a signed delegate action between the browser and the relayer.
 * The browser borsh-encodes the SignedDelegate (near-api-js does it) and sends
 * base64. The relayer decodes it back with the same schema. No JSON of bigints.
 *
 * This file is copied verbatim into `src/near/codec.ts` on the client side.
 */
import { deserialize } from "borsh";
import { SCHEMA, encodeSignedDelegate } from "near-api-js";
import type { SignedDelegate } from "near-api-js";

export function encodeSignedDelegateBase64(signedDelegate: SignedDelegate): string {
  return Buffer.from(encodeSignedDelegate(signedDelegate)).toString("base64");
}

export function decodeSignedDelegateBase64(payload: string): SignedDelegate {
  const bytes = Buffer.from(payload, "base64");
  const raw = deserialize(SCHEMA.SignedDelegate, bytes) as unknown;
  if (!raw || typeof raw !== "object") throw new Error("Invalid signed delegate payload");
  return raw as SignedDelegate;
}
