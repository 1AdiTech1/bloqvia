/**
 * Ask Bloq — one question, one grounded answer from the model on NEAR AI
 * Cloud, through the relayer (`POST /ask`). The model only writes text; it
 * cannot see balances or touch rewards. Each answer carries the model, the
 * chat id and the signature kind for the Verification Center.
 *
 *   const bloq = useAskBloq();
 *   await bloq.ask("Why does the relayer pay my gas?", lessonId);
 *   bloq.answer        // string | null
 *   bloq.provenance    // { model, chat_id, signature_kind } | null
 *   bloq.loading / bloq.error / bloq.reset()
 *
 * Local component state on purpose: every sheet gets its own conversation.
 */
import { useCallback, useRef, useState } from "react";
import { relayerApi } from "./relayer";
import { useBloqvia } from "./useBloqvia";
import type { AskResult } from "./types";

export interface AskBloqState {
  question: string | null;
  answer: string | null;
  provenance: AskResult["generated_by"] | null;
  loading: boolean;
  error: string | null;
}

const EMPTY: AskBloqState = { question: null, answer: null, provenance: null, loading: false, error: null };

export function useAskBloq(): AskBloqState & { ask: (question: string, lessonId?: string) => Promise<void>; reset: () => void } {
  const { accountId } = useBloqvia();
  const [state, setState] = useState<AskBloqState>(EMPTY);
  const seq = useRef(0);

  const ask = useCallback(
    async (question: string, lessonId?: string) => {
      const q = question.trim();
      if (!q) return;
      const id = ++seq.current;
      setState({ question: q, answer: null, provenance: null, loading: true, error: null });
      try {
        const r = await relayerApi.ask(q, lessonId, accountId);
        if (id !== seq.current) return; // a newer question is in flight
        setState({ question: q, answer: r.answer, provenance: r.generated_by, loading: false, error: null });
      } catch (e) {
        if (id !== seq.current) return;
        setState({ question: q, answer: null, provenance: null, loading: false, error: (e as Error).message });
      }
    },
    [accountId],
  );

  const reset = useCallback(() => {
    seq.current += 1;
    setState(EMPTY);
  }, []);

  return { ...state, ask, reset };
}
