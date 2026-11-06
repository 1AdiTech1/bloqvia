import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Copy, Check } from "lucide-react";
import { AgentPod, talkMs, type AgentPodHandle } from "@/bloq";
import { useAskBloq } from "@/near";
import { verifyUrl } from "@/components/lab/useDesktop";

type Prov = { model?: string; chat_id?: string; signature_kind?: string | null } | null;
type Msg = { id: number; who: "bot" | "me"; text: string; prov?: Prov; typed?: boolean };

const GREETING =
  "Hi, I'm Bloq's AI agent. Ask me anything about Bloqvia or Web3. I won't give quest answers, but I'll explain the idea behind them.";
const CHIPS = ["What's a private key?", "Who pays the gas?", "How do your prices work?", "Can you tell me the quest answer?"];

function Typed({ text, still, onDone }: { text: string; still: boolean; onDone: () => void }) {
  const [n, setN] = useState(still ? text.length : 0);
  useEffect(() => {
    if (still) { setN(text.length); onDone(); return; }
    let i = 0;
    const t = setInterval(() => {
      i += 2; setN(i);
      if (i >= text.length) { clearInterval(t); onDone(); }
    }, 24);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, still]);
  return <>{text.slice(0, n)}</>;
}

function CopyId({ id }: { id: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="lv-ask-copy"
      aria-label="Copy chat id"
      title={id}
      onClick={() => { navigator.clipboard?.writeText(id).then(() => { setOk(true); setTimeout(() => setOk(false), 1400); }); }}
    >
      {ok ? <Check size={12} /> : <Copy size={12} />} chat id
    </button>
  );
}

export function AskDock() {
  const still = !!useReducedMotion();
  const bloq = useAskBloq();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, who: "bot", text: GREETING, typed: true }]);
  const [q, setQ] = useState("");
  const asked = msgs.some((m) => m.who === "me");
  const seq = useRef(1);
  const dockBtn = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const dockPod = useRef<AgentPodHandle>(null);
  const chatPod = useRef<AgentPodHandle>(null);
  const lastSeen = useRef<string | null>(null);

  // Periodic jump while closed.
  useEffect(() => {
    if (open || still) return;
    const t = setInterval(() => dockPod.current?.peek(), 14000);
    return () => clearInterval(t);
  }, [open, still]);

  // Focus + Esc.
  useEffect(() => {
    if (!open) return;
    const f = setTimeout(() => input.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(f); window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Answers / errors from the hook become messages.
  useEffect(() => {
    if (bloq.loading) return;
    const key = bloq.answer ? `a:${bloq.question}:${bloq.answer}` : bloq.error ? `e:${bloq.question}:${bloq.error}` : null;
    if (!key || key === lastSeen.current) return;
    lastSeen.current = key;
    if (bloq.answer) {
      setMsgs((m) => [...m, { id: seq.current++, who: "bot", text: bloq.answer!, prov: bloq.provenance as Prov }]);
      chatPod.current?.talk(talkMs(bloq.answer));
    } else {
      setMsgs((m) => [...m, { id: seq.current++, who: "bot", text: `I couldn't reach my brain just now (${bloq.error}). Try again in a moment.`, typed: true }]);
    }
  }, [bloq.loading, bloq.answer, bloq.error, bloq.question, bloq.provenance]);

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, bloq.loading]);

  function close() {
    setOpen(false);
    setTimeout(() => dockBtn.current?.focus(), 30);
  }

  function send(text: string) {
    const t = text.trim().slice(0, 300);
    if (!t || bloq.loading) return;
    setMsgs((m) => [...m, { id: seq.current++, who: "me", text: t }]);
    setQ("");
    void bloq.ask(t);
  }

  const markTyped = (id: number) => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, typed: true } : x)));

  return (
    <>
      <div className={`lv-dock${open ? " hidden" : ""}`}>
        <button
          ref={dockBtn}
          type="button"
          className="lv-dock-btn"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="lv-ask-chat"
          onClick={() => setOpen(true)}
        >
          <AgentPod size={48} ref={dockPod} />
          <span className="lv-dock-txt">
            <b>Ask Bloq</b>
            <small><i className="lv-live" />AI agent · online</small>
          </span>
        </button>
      </div>

      <section id="lv-ask-chat" className="lv-chat relative" role="dialog" aria-label="Ask Bloq" hidden={!open}>
        <div className="lv-chat-head" style={{ paddingTop: 40 }}>
          <AgentPod size={44} ref={chatPod} />
          <div>
            <b>Ask Bloq</b>
            <small><i className="lv-live" />AI agent on NEAR AI Cloud</small>
          </div>
          <button type="button" className="lv-chat-x" aria-label="Close the chat" onClick={close}>×</button>
        </div>

        <div ref={log} className="lv-chat-log" aria-live="polite">
          {msgs.map((m) => (
            <div key={m.id} className={`lv-msg ${m.who}`}>
              {m.who === "bot" && !m.typed ? (
                <Typed text={m.text} still={still} onDone={() => markTyped(m.id)} />
              ) : (
                m.text
              )}
              {m.prov && (
                <span className="lv-msg-meta">
                  NEAR AI Cloud · {m.prov.model ?? "unknown model"}
                  {m.prov.signature_kind && (
                    <>
                      <br />signed ({m.prov.signature_kind}) ·{" "}
                      <a href={verifyUrl(m.prov.model)} target="_blank" rel="noopener noreferrer">Verify ↗</a>
                    </>
                  )}
                  {m.prov.chat_id && <> <CopyId id={m.prov.chat_id} /></>}
                </span>
              )}
            </div>
          ))}
          {bloq.loading && (
            <div className="lv-msg bot lv-typing" aria-label="Bloq is typing"><i /><i /><i /></div>
          )}
        </div>

        {!asked && (
          <div className="lv-chat-sugg">
            {CHIPS.map((c) => (
              <button key={c} type="button" onClick={() => send(c)} disabled={bloq.loading}>{c}</button>
            ))}
          </div>
        )}

        <form className="lv-chat-form" onSubmit={(e) => { e.preventDefault(); send(q); }}>
          <label htmlFor="lv-ask-in" className="sr-only">Your question</label>
          <input
            id="lv-ask-in"
            ref={input}
            maxLength={300}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask about keys, gas, prices…"
            autoComplete="off"
          />
          <button type="submit" disabled={!q.trim() || bloq.loading}>Send</button>
        </form>
      </section>
    </>
  );
}
