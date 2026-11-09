import { useEffect, useRef, useState } from "react";
import { useMotionOff } from "@/bloq";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { Copy, X } from "lucide-react";
import { useGame } from "@/game/useGame";
import { Press, labEase } from "./motion";
import { useIsDesktop } from "./useDesktop";
import { SheetGrab, useSheetDrag } from "./SheetGrab";

/** "Play again from zero" (prompt 26): makes sure the player keeps the key of the account they leave. */
export function PlayAgainSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <AnimatePresence>{open && <PlayAgainPanel key="again" onClose={onClose} />}</AnimatePresence>;
}

function PlayAgainPanel({ onClose }: { onClose: () => void }) {
  const game = useGame();
  const navigate = useNavigate();
  const reduce = useMotionOff();
  const desktop = useIsDesktop();
  const sheet = useSheetDrag(onClose, !desktop);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const preview = game.exportSecretKey();

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    title.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const copy = async () => {
    const key = game.exportSecretKey();
    if (!key) return;
    try { await navigator.clipboard.writeText(key); } catch { return; }
    setCopied(true);
    setSaved(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const startOver = () => { game.signOut(); navigate({ to: "/" }); };

  return (
    <motion.div className="fixed inset-0 z-[55] flex items-end justify-center dk:items-center dk:py-12 dk:pl-[calc(max(0px,(100vw-1440px)/2)+220px)] dk:pr-[calc(max(0px,(100vw-1440px)/2)+330px)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Play again">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-navy/50" />
      <motion.div
        initial={reduce ? { opacity: 0 } : desktop ? { scale: 0.96, opacity: 0 } : { y: 80, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={reduce ? { opacity: 0 } : desktop ? { scale: 0.96, opacity: 0 } : { y: 80, opacity: 0 }}
        transition={desktop ? { duration: 0.22, ease: labEase } : { duration: 0.5, ease: labEase }}
        className="relative w-full max-w-[480px] rounded-t-[2rem] bg-ivory px-6 pb-7 text-navy shadow-lift dk:max-w-[460px] dk:rounded-[28px] dk:pt-6"
        ref={sheet.ref}
        {...sheet.dragProps}
      >
        <SheetGrab controls={sheet.controls} onClose={onClose} />
        <Press onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full text-navy/60">
          <X className="h-5 w-5" />
        </Press>
        <p className="pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy/60">Play again</p>
        <h2 ref={title} tabIndex={-1} className="mt-1 font-display text-[26px] font-medium tracking-[-0.03em] outline-none">Start again from zero?</h2>
        <p className="mt-3 text-[15px] leading-relaxed">You'll get a brand-new NEAR account with an empty Passport, and the game starts from the first quest. This account isn't deleted: it stays on NEAR testnet with your Passport, both seasons and everything you earned. Only this key can open it again.</p>
        <div className="mt-4 flex items-center gap-2">
          <p className="flex-1 truncate rounded-2xl bg-muted p-3 font-mono text-sm">{preview ? `${preview.slice(0, 12)}${"•".repeat(16)}` : "—"}</p>
          <Press onClick={() => void copy()} className="flex min-h-11 items-center gap-1.5 rounded-full bg-navy px-4 font-semibold text-ivory">
            <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy key"}
          </Press>
        </div>
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-5 w-5 accent-[var(--navy)]" />
          I've saved my key somewhere safe
        </label>
        <div className="mt-4 flex flex-col gap-2.5">
          <Press onClick={startOver} disabled={!saved} className="min-h-12 rounded-full bg-navy font-display font-semibold text-lime disabled:opacity-40">Start from zero</Press>
          <Press onClick={onClose} className="min-h-12 rounded-full border-[1.5px] border-navy/25 font-display font-semibold">Keep playing</Press>
        </div>
      </motion.div>
    </motion.div>
  );
}
