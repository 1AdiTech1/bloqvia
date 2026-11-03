/**
 * How the learner signs. Two implementations behind one interface so the
 * Nov 4 auth spike can swap path A in without touching the game code.
 *
 *  - LocalKeySigner  (path B, default): a keypair generated in this browser,
 *    kept in localStorage, registered with the relayer as a function-call key.
 *  - NearAuthSigner  (path A): NEAR Auth (@fast-auth-near/react-sdk). Filled in
 *    by the spike only if signing does not pop Auth0 on every call.
 *
 * Either way the learner signs a NEP-366 DelegateAction and the relayer pays.
 */
import { Account, JsonRpcProvider, KeyPair } from "near-api-js";
import type { Action, KeyPairString } from "near-api-js";
import { encodeSignedDelegateBase64 } from "./codec";
import { DELEGATE_TTL_BLOCKS, NEAR_CONFIG } from "./config";
import { relayerApi } from "./relayer";

export interface LearnerSigner {
  readonly kind: "local-key" | "near-auth";
  /** null until the account exists on chain. */
  accountId(): string | null;
  /** Creates/registers the account if needed. Idempotent. */
  ensureAccount(): Promise<string>;
  /** Signs a DelegateAction for `receiverId` and returns the base64 payload. */
  signDelegate(receiverId: string, actions: Action[]): Promise<string>;
  /** Forgets the session in this browser (path B also returns the secret so the user can export it). */
  signOut(): void;
  /** Path B only: the secret key, shown once at the reveal step. */
  exportSecretKey(): string | null;
}

const STORAGE_KEY = "bloqvia:session:v1";

interface StoredSession {
  secretKey: KeyPairString;
  accountId: string | null;
}

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function writeSession(session: StoredSession | null): void {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode: the session lives in memory only */
  }
}

export class LocalKeySigner implements LearnerSigner {
  readonly kind = "local-key" as const;
  private readonly provider = new JsonRpcProvider({ url: NEAR_CONFIG.rpcUrl });
  private keyPair: KeyPair;
  private account: string | null;

  constructor() {
    const stored = readSession();
    if (stored) {
      this.keyPair = KeyPair.fromString(stored.secretKey);
      this.account = stored.accountId;
    } else {
      this.keyPair = KeyPair.fromRandom("ed25519");
      this.account = null;
      writeSession({ secretKey: this.keyPair.toString(), accountId: null });
    }
  }

  accountId(): string | null {
    return this.account;
  }

  async ensureAccount(): Promise<string> {
    if (this.account) return this.account;
    const result = await relayerApi.registerKey(this.keyPair.getPublicKey().toString());
    this.account = result.accountId;
    writeSession({ secretKey: this.keyPair.toString(), accountId: this.account });
    return this.account;
  }

  async signDelegate(receiverId: string, actions: Action[]): Promise<string> {
    const accountId = await this.ensureAccount();
    const account = new Account(accountId, this.provider, this.keyPair.toString());
    const { signedDelegate } = await account.createSignedMetaTransaction({
      receiverId,
      actions,
      blockHeightTtl: DELEGATE_TTL_BLOCKS,
    });
    return encodeSignedDelegateBase64(signedDelegate);
  }

  signOut(): void {
    writeSession(null);
    this.account = null;
    this.keyPair = KeyPair.fromRandom("ed25519");
  }

  exportSecretKey(): string | null {
    return this.keyPair.toString();
  }
}

/**
 * Path A placeholder. The spike (docs/SPIKE-AUTH.md) replaces the bodies with
 * @fast-auth-near/react-sdk calls. Until then it throws, so nothing in the app
 * can silently depend on it.
 */
export class NearAuthSigner implements LearnerSigner {
  readonly kind = "near-auth" as const;
  accountId(): string | null {
    return null;
  }
  async ensureAccount(): Promise<string> {
    throw new Error("NearAuthSigner is not wired yet: see docs/SPIKE-AUTH.md");
  }
  async signDelegate(): Promise<string> {
    throw new Error("NearAuthSigner is not wired yet: see docs/SPIKE-AUTH.md");
  }
  signOut(): void {}
  exportSecretKey(): string | null {
    return null;
  }
}

export function createSigner(kind: LearnerSigner["kind"] = "local-key"): LearnerSigner {
  return kind === "near-auth" ? new NearAuthSigner() : new LocalKeySigner();
}
