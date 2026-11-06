import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useGame } from "@/game/useGame";
import { CTA, ease } from "./primitives";
import { BloqMark } from "@/components/Logo";
import { BloqFace } from "@/bloq";
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
            <BloqFace size={80} hat="cap" className="!absolute right-[60px] top-[14px]" />
            <h2 id="signin-title" style={{ fontSize: "min(25px, 7.6cqi)" }}
              className="mt-6 whitespace-nowrap font-display font-medium uppercase tracking-[-0.04em]">
              {returning ? "Welcome back" : "Start without a wallet"}
            </h2>
            <p className="mt-2 text-muted-foreground">
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
