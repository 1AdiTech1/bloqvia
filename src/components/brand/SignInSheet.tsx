import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useGame } from "@/game/useGame";
import { CTA, ease } from "./primitives";
import { BloqMark } from "@/components/Logo";
import { Bloq, type BloqHandle, type BloqPose } from "@/bloq";
import { LabLoader } from "@/components/LabLoader";

/** App-held key sign-in sheet: calls start() then goes to /map. */
export function SignInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const game = useGame();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const button = useRef<HTMLButtonElement>(null);
  const returning = !!game.accountId;

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => button.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  const go = async () => {
    if (game.accountId) return navigate({ to: "/map" });
    try {
      await game.start();
      navigate({ to: "/map" });
    } catch {
      /* error toast shows game.error */
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button aria-label="Close" className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="signin-title"
            initial={reduce ? false : { y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.5, ease }}
            style={{ containerType: "inline-size" }}
            className="relative w-full max-w-md rounded-t-[2rem] bg-ivory p-7 pb-10 text-navy shadow-lift md:rounded-[2rem] md:p-9"
          >
            <button type="button" onClick={onClose} aria-label="Close" className="tap absolute right-4 top-4 flex items-center justify-center rounded-full hover:bg-navy/5">
              <X className="h-5 w-5" />
            </button>
            <BloqMark size={40} />
            <SittingBloq reduce={!!reduce} />
            <h2 id="signin-title" style={{ fontSize: "min(25px, 7.6cqi)" }}
              className="mt-6 whitespace-nowrap font-display font-medium uppercase tracking-[-0.04em]">
              {returning ? "Welcome back" : "Start without a wallet"}
            </h2>
            <p lang="en" className="si-copy mt-2 text-muted-foreground">
              {returning
                ? "Your account is in this browser."
                : "No seed phrase, no password, no downloads. We create a NEAR account for you right here in this browser and hold its key for you — you get the key at the end, with everything you earned."}
            </p>
            {game.busy && !returning ? (
              <div className="mt-6 rounded-3xl bg-navy px-5 py-4">
                <LabLoader size={32} label="Creating your NEAR account… about five seconds" />
              </div>
            ) : (
              <CTA ref={button} type="button" variant="navy" onClick={go} className="mt-6 w-full">
                {returning ? "Continue to the map" : "Create my account"}
              </CTA>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Bloq walks along the card's top edge to his spot and sits down, legs over the front. */
function SittingBloq({ reduce }: { reduce: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const bloq = useRef<BloqHandle>(null);
  const [pos, setPos] = useState<{ x: number; y: number; w: number; t: string } | null>(null);
  const [pose, setPose] = useState<BloqPose>("idle");
  const [seated, setSeated] = useState(false);
  const [bounce, setBounce] = useState(0);

  useEffect(() => {
    const card = box.current?.parentElement;
    if (!card) return;
    const cw = card.getBoundingClientRect().width;
    const narrow = cw < 400;
    const w = narrow ? 96 : 112;
    const h = (w * 4) / 3;
    const target = cw - w - (narrow ? 50 : 62);
    const sitY = h * 0.21;
    const timers: number[] = [];
    if (reduce) {
      setPose("sit");
      setPos({ x: target, y: sitY, w, t: "none" });
      setSeated(true);
      return;
    }
    setPos({ x: 26, y: 0, w, t: "none" });
    const dur = Math.max(700, (target - 26) * 4);
    timers.push(window.setTimeout(() => {
      bloq.current?.walking(true);
      setPos({ x: target, y: 0, w, t: `transform ${dur}ms linear` });
      timers.push(window.setTimeout(() => {
        bloq.current?.walking(false);
        setPose("sit");
        setPos({ x: target, y: sitY, w, t: "transform 420ms cubic-bezier(.3,.7,.4,1)" });
        timers.push(window.setTimeout(() => { bloq.current?.setMood("laugh", 900); setSeated(true); }, 420));
      }, dur));
    }, 450));
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  useEffect(() => {
    if (!seated) return;
    const onMove = (e: PointerEvent) => {
      const el = box.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2);
      const dy = (e.clientY - (r.top + r.height * 0.3)) / (window.innerHeight / 2);
      bloq.current?.look(Math.max(-1, Math.min(1, dx)), Math.max(-1, Math.min(1, dy)));
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [seated]);

  const w = pos?.w ?? 112;
  return (
    <div
      ref={box}
      className="absolute left-0 z-10"
      style={{
        width: w,
        bottom: `calc(100% - ${(w * 4) / 3 * 0.04}px)`,
        transform: `translate(${pos?.x ?? 26}px, ${pos?.y ?? 0}px)`,
        transition: pos?.t ?? "none",
        visibility: pos ? "visible" : "hidden",
      }}
    >
      <button
        type="button"
        aria-label="Bloq, sitting on the card"
        onPointerEnter={() => bloq.current?.setMood("laugh", 700)}
        onClick={() => { bloq.current?.setMood("laugh", 1400); if (!reduce) setBounce((b) => b + 1); }}
        className="block w-full cursor-pointer"
      >
        <div key={bounce} className={bounce ? "si-bounce" : undefined}>
          <Bloq ref={bloq} hat="cap" pose={pose} facing="right" label="Bloq" />
        </div>
      </button>
    </div>
  );
}
