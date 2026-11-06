import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, X } from "lucide-react";
import { AgentPod, talkMs, type AgentPodHandle } from "@/bloq";
import { useAskBloq } from "@/near";
import { IS_MOCK } from "@/game/useGame";
import { LabLoader } from "@/components/LabLoader";
import { Press, labEase } from "./motion";
import { useIsDesktop, verifyUrl } from "./useDesktop";
import { cn } from "@/lib/utils";

export type AskContext = "quiz" | "shop" | "map" | "missions" | "passport";
type Context = AskContext;

const CHIPS: Record<Context, string[]> = {
  quiz: ["Explain this another way", "Why does this matter on NEAR?", "What should I pay attention to?"],
  shop: ["Why did the price change?", "What is the 2.5% spread?", "Why does the shop close?"],
  map: ["What is the Passport?", "How does the streak work?", "Who pays my gas?"],
  missions: ["How do mission rewards get paid?", "What is a DAO vote?", "Who checks that I qualified?"],
  passport: ["What does soulbound mean?", "How does my Passport level up?", "Can I sell my Passport?"],
};

type Props = { open: boolean; onClose: () => void; lessonId?: string; context: Context };

/** Ask Bloq — a bottom sheet stacked above the quiz sheet. Hidden in mock mode. */
export function AskBloqSheet(props: Props) {
  if (IS_MOCK) return null;
  return <AnimatePresence>{props.open && <AskBloqPanel key="ask" {...props} />}</AnimatePresence>;
}

/** Small ghost entry button; renders nothing in mock mode. */
export function AskBloqButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  if (IS_MOCK) return null;
  return (
    <Press onClick={onClick} className={cn("inline-flex min-h-[44px] items-center gap-2 rounded-full px-3 text-sm font-semibold underline-offset-4 hover:underline", className)}>
      <AgentPod size={32} />
      {label}
    </Press>
  );
}

function AskBloqPanel({ onClose, lessonId, context }: Props) {
  const reduce = useReducedMotion();
  const desktop = useIsDesktop();
  const bloq = useAskBloq();
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const close = () => {
    bloq.reset();
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = (q: string) => {
    if (!q.trim() || bloq.loading) return;
    setText("");
    void bloq.ask(q, lessonId);
  };

  const another = () => {
    bloq.reset();
    setTimeout(() => input.current?.focus(), 0);
  };

  const p = bloq.provenance;
  const pod = useRef<AgentPodHandle>(null);
  useEffect(() => {
    if (bloq.answer) pod.current?.talk(talkMs(bloq.answer));
  }, [bloq.answer]);

  return (
    <motion.div className="fixed inset-0 z-[55] flex items-end justify-center dk:items-center dk:py-12 dk:pl-[calc(max(0px,(100vw-1440px)/2)+220px)] dk:pr-[calc(max(0px,(100vw-1440px)/2)+330px)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Ask Bloq">
      <button aria-label="Close" onClick={close} className="absolute inset-0 bg-navy/50" />
      <motion.div
        initial={reduce ? { opacity: 0 } : desktop ? { scale: 0.96, opacity: 0 } : { y: 80, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={reduce ? { opacity: 0 } : desktop ? { scale: 0.96, opacity: 0 } : { y: 80, opacity: 0 }}
        transition={desktop ? { duration: 0.22, ease: labEase } : { duration: 0.5, ease: labEase }}
        className="relative flex max-h-[85vh] w-full max-w-[480px] flex-col rounded-t-[2rem] bg-ivory py-[14px] pr-2 text-navy shadow-lift dk:max-w-[560px] dk:max-h-[calc(100vh-96px)] dk:rounded-[28px]"
      >
        <Press onClick={close} aria-label="Close" className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full text-navy/60">
          <X className="h-5 w-5" />
        </Press>
        <div className="bq-scroll min-h-0 flex-1 overflow-y-auto pb-5 pl-6 pr-4 pt-2 dk:pt-3">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-navy/15 dk:hidden" />

        <div className="flex items-center gap-3 pr-10 pt-[18px]">
          <div className="shrink-0"><AgentPod size={52} ref={pod} /></div>
          <div>
            <h2 className="font-display text-2xl font-medium uppercase leading-none tracking-[-0.04em]">Ask Bloq</h2>
            <p className="mt-1 text-sm text-muted-foreground">Plain-words answers from Bloq. He explains; he never hands out quest answers.</p>
          </div>
        </div>

        {!bloq.answer && !bloq.loading && (
          <div className="mt-5 flex flex-wrap gap-2">
            {CHIPS[context].map((c) => (
              <Press key={c} onClick={() => send(c)} className="min-h-[44px] rounded-full bg-lavender-soft px-4 text-left text-sm font-semibold">
                {c}
              </Press>
            ))}
          </div>
        )}

        {bloq.loading && <div className="mt-6"><LabLoader tone="navy" label="Bloq is thinking…" /></div>}

        {bloq.answer && (
          <div className="mt-5">
            {bloq.question && <p className="text-sm text-muted-foreground">{bloq.question}</p>}
            <div className="mt-2 rounded-3xl rounded-bl-md bg-navy p-5 text-[15px] leading-relaxed text-ivory whitespace-pre-line">{bloq.answer}</div>
            <p className="mt-3 text-xs text-lavender">
              Answered by an AI on NEAR AI Cloud
              {p?.signature_kind === "provider_tee" && " · signed in a TEE"}
              {p && (
                <> · <a href={verifyUrl(p.model)} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">Verify</a></>
              )}
            </p>
            {p && <p className="mt-1 break-all font-mono text-[11px] text-navy/50">chat {p.chat_id}</p>}
            <Press onClick={another} className="mt-4 min-h-[44px] rounded-full border-2 border-navy/15 px-5 text-sm font-semibold">Ask another</Press>
          </div>
        )}

        {bloq.error && (
          <div className="mt-5 rounded-2xl border-l-4 border-coral bg-coral/15 p-4 text-[15px] leading-relaxed">{bloq.error}</div>
        )}

        <form
          className="mt-5 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            enterKeyHint="send"
            placeholder="Ask about keys, gas, contracts, prices, the Passport, the streak…"
            aria-label="Your question"
            className="min-h-[48px] flex-1 rounded-full border-2 border-navy/10 bg-card px-4 text-[15px] outline-none focus:border-navy"
          />
          <Press type="submit" aria-label="Send" disabled={bloq.loading || !text.trim()} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lime text-navy shadow-lift disabled:opacity-40">
            <ArrowUp className="h-5 w-5" />
          </Press>
        </form>
        </div>
      </motion.div>
    </motion.div>
  );
}
