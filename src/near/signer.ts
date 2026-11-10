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
  /** The public key the account votes with on the cohort DAO (the second key), or null when the session has none. */
  daoPublicKey(): string | null;
  /** Signs a short message with the second key (proof of who proposes a bounty); null without that key. */
  signWithDaoKey(message: string): { message: string; signature: string; publicKey: string } | null;
}

const STORAGE_KEY = "bloqvia:session:v1";

interface StoredSession {
  secretKey: KeyPairString;
  accountId: string | null;
  /** The second key (Nov 10): limited to the cohort DAO's act_proposal, the Passport's vote. Absent on older sessions. */
  daoSecretKey?: KeyPairString;
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
  private daoKeyPair: KeyPair | null;
  private account: string | null;

  constructor() {
    const stored = readSession();
    if (stored) {
      this.keyPair = KeyPair.fromString(stored.secretKey);
      // a session from before the vote key existed keeps working; it just cannot vote (a key cannot be added later)
      this.daoKeyPair = stored.daoSecretKey ? KeyPair.fromString(stored.daoSecretKey) : stored.accountId ? null : KeyPair.fromRandom("ed25519");
      this.account = stored.accountId;
      if (!stored.daoSecretKey && this.daoKeyPair) this.save();
    } else {
      this.keyPair = KeyPair.fromRandom("ed25519");
      this.daoKeyPair = KeyPair.fromRandom("ed25519");
      this.account = null;
      this.save();
    }
  }

  private save(): void {
    writeSession({ secretKey: this.keyPair.toString(), accountId: this.account, ...(this.daoKeyPair ? { daoSecretKey: this.daoKeyPair.toString() } : {}) });
  }

  accountId(): string | null {
    return this.account;
  }

  async ensureAccount(): Promise<string> {
    if (this.account) return this.account;
    const result = await relayerApi.registerKey(this.keyPair.getPublicKey().toString(), this.daoKeyPair?.getPublicKey().toString());
    this.account = result.accountId;
    if (!result.canVote) this.daoKeyPair = null; // the account existed already without the vote key
    this.save();
    return this.account;
  }

  daoPublicKey(): string | null {
    return this.daoKeyPair?.getPublicKey().toString() ?? null;
  }

  signWithDaoKey(message: string): { message: string; signature: string; publicKey: string } | null {
    if (!this.daoKeyPair) return null;
    const { signature } = this.daoKeyPair.sign(new TextEncoder().encode(message));
    let bin = "";
    for (const b of signature) bin += String.fromCharCode(b);
    return { message, signature: btoa(bin), publicKey: this.daoKeyPair.getPublicKey().toString() };
  }

  async signDelegate(receiverId: string, actions: Action[]): Promise<string> {
    const accountId = await this.ensureAccount();
    // the key that may sign for this receiver: core's for the game, the DAO's for a vote
    const key = receiverId === NEAR_CONFIG.daoId ? this.daoKeyPair : this.keyPair;
    if (!key) throw new Error("This account was created before voting existed; a new account can vote");
    const account = new Account(accountId, this.provider, key.toString());
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
    this.daoKeyPair = KeyPair.fromRandom("ed25519");
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
  daoPublicKey(): string | null {
    return null;
  }
  signWithDaoKey(): null {
    return null;
  }
}

export function createSigner(kind: LearnerSigner["kind"] = "local-key"): LearnerSigner {
  return kind === "near-auth" ? new NearAuthSigner() : new LocalKeySigner();
}
