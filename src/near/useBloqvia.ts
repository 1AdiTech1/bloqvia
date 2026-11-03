/**
 * The ONE React hook the UI talks to. Lovable screens call these functions
 * and render these fields; they never touch RPC, keys or the relayer.
 *
 *   const b = useBloqvia();
 *   b.start()                       // sign-in/registration (no wallet UI)
 *   b.completeLesson(id, answer)    // -> { txHash }
 *   b.sellToBloq(item, 1) / b.buyFromBloq(item, 1) / b.graduate()
 *   b.learner, b.bloq, b.lessons, b.passport, b.lastTx, b.busy, b.error
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { game, views } from "./contracts";
import { explorer } from "./explorer";
import { createSigner, type LearnerSigner } from "./signer";
import type { BloqView, LearnerView, LessonPublic, PassportView, RelayResult } from "./types";

export interface BloqviaState {
  accountId: string | null;
  learner: LearnerView | null;
  passport: PassportView | null;
  bloq: BloqView | null;
  lessons: LessonPublic[];
  lastTx: (RelayResult & { url: string }) | null;
  busy: boolean;
  error: string | null;
}

export interface Bloqvia extends BloqviaState {
  start: () => Promise<string>;
  refresh: () => Promise<void>;
  completeLesson: (lessonId: string, answer: string) => Promise<RelayResult>;
  sellToBloq: (tokenId: string, amount?: number) => Promise<RelayResult>;
  buyFromBloq: (tokenId: string, amount?: number) => Promise<RelayResult>;
  graduate: () => Promise<RelayResult>;
  signOut: () => void;
  exportSecretKey: () => string | null;
  explorer: typeof explorer;
}

export function useBloqvia(signerKind: LearnerSigner["kind"] = "local-key"): Bloqvia {
  const signerRef = useRef<LearnerSigner | null>(null);
  if (!signerRef.current) signerRef.current = createSigner(signerKind);
  const signer = signerRef.current;

  const [state, setState] = useState<BloqviaState>({
    accountId: signer.accountId(),
    learner: null,
    passport: null,
    bloq: null,
    lessons: [],
    lastTx: null,
    busy: false,
    error: null,
  });

  const refresh = useCallback(async () => {
    const accountId = signer.accountId();
    const [lessons, bloq, learner, passport] = await Promise.all([
      views.lessons(),
      views.bloq(),
      accountId ? views.learner(accountId) : Promise.resolve(null),
      accountId ? views.passport(accountId) : Promise.resolve(null),
    ]);
    setState((s) => ({ ...s, accountId, lessons, bloq, learner, passport }));
  }, [signer]);

  useEffect(() => {
    void refresh().catch((e: Error) => setState((s) => ({ ...s, error: e.message })));
  }, [refresh]);

  const run = useCallback(
    async (fn: () => Promise<RelayResult>): Promise<RelayResult> => {
      setState((s) => ({ ...s, busy: true, error: null }));
      try {
        const result = await fn();
        setState((s) => ({ ...s, lastTx: { ...result, url: explorer.tx(result.txHash) } }));
        await refresh();
        return result;
      } catch (e) {
        setState((s) => ({ ...s, error: (e as Error).message }));
        throw e;
      } finally {
        setState((s) => ({ ...s, busy: false }));
      }
    },
    [refresh],
  );

  const start = useCallback(async () => {
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      const accountId = await signer.ensureAccount();
      await refresh();
      return accountId;
    } catch (e) {
      setState((s) => ({ ...s, error: (e as Error).message }));
      throw e;
    } finally {
      setState((s) => ({ ...s, busy: false }));
    }
  }, [signer, refresh]);

  return useMemo<Bloqvia>(
    () => ({
      ...state,
      start,
      refresh,
      completeLesson: (lessonId, answer) => run(() => game.completeLesson(signer, lessonId, answer)),
      sellToBloq: (tokenId, amount = 1) => run(() => game.sellToBloq(signer, tokenId, amount)),
      buyFromBloq: (tokenId, amount = 1) => run(() => game.buyFromBloq(signer, tokenId, amount)),
      graduate: () => run(() => game.graduate(signer)),
      signOut: () => {
        signer.signOut();
        setState((s) => ({ ...s, accountId: null, learner: null, passport: null, lastTx: null }));
      },
      exportSecretKey: () => signer.exportSecretKey(),
      explorer,
    }),
    [state, start, refresh, run, signer],
  );
}
