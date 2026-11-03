import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useGame } from "@/game/useGame";
import { CTA, ease } from "./primitives";
import { BloqMark } from "@/components/Logo";

/** Email sign-in bottom sheet: calls start() then goes to /map. */
export function SignInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const game = useGame();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => input.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
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
        <motion.div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button aria-label="Close" className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={onClose} />
          <motion.form
            role="dialog"
            aria-modal="true"
            aria-labelledby="signin-title"
            onSubmit={submit}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.5, ease }}
            className="relative w-full max-w-md rounded-t-[2rem] bg-ivory p-7 pb-10 text-navy shadow-lift md:rounded-[2rem] md:p-9"
          >
            <button type="button" onClick={onClose} aria-label="Close" className="tap absolute right-4 top-4 flex items-center justify-center rounded-full hover:bg-navy/5">
              <X className="h-5 w-5" />
            </button>
            <BloqMark size={40} />
            <h2 id="signin-title" className="mt-6 font-display text-3xl font-medium uppercase tracking-[-0.04em]">Begin with your email</h2>
            <p className="mt-2 text-muted-foreground">No password, no downloads. We'll set everything up for you.</p>
            <label htmlFor="signin-email" className="sr-only">Email</label>
            <input
              ref={input}
              id="signin-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="tap mt-6 w-full rounded-full border border-border bg-card px-5 text-base outline-none focus:border-navy"
            />
            <CTA type="submit" variant="navy" disabled={game.busy} className="mt-3 w-full">
              {game.busy ? "Setting up…" : "Continue"}
            </CTA>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
