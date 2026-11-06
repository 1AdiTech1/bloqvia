import { useId, type PointerEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const GUILLOCHE = Array.from({ length: 14 }, (_, i) => {
  let d = "";
  for (let x = 0; x <= 330; x += 6) {
    const y = 110 + Math.sin(x / 26 + i * 0.45) * (30 + i * 4) + Math.sin(x / 9 + i) * 4;
    d += (x ? " L" : "M") + x + " " + y.toFixed(1);
  }
  return { d, stroke: i % 3 ? "#b47ff0" : "#d4f033" };
});

const pad = (s: string, n = 44) => (s + "<".repeat(n)).slice(0, n);

/** Two MRZ lines built from the account id and level, ending in SEALED when graduated. */
export function passportMrz(accountId: string, level: number, graduated: boolean): [string, string] {
  const acct = accountId.toUpperCase().replace(/[^A-Z0-9]+/g, "<");
  return [pad(`P<BLQ<${acct}`), pad(`NEP171<SOULBOUND<<LVL${level}<<`.padEnd(38, "<") + (graduated ? "SEALED" : ""), 44)];
}

export function passportStatus(level: number, graduated: boolean): string {
  return graduated ? "Graduate" : level >= 3 ? "Ready to graduate" : "In progress";
}

/**
 * The Web3 Passport card (same look as the landing's `lv-pass`), filled with a player's fields.
 * `sealed` shows the three blocks in the seal's centre; `stampDelay` springs them in.
 */
export function Web3Passport({
  holder,
  level,
  graduated,
  sealed = graduated,
  stampDelay,
  flat = true,
  onClick,
  className,
}: {
  holder: string;
  level: number;
  graduated: boolean;
  sealed?: boolean;
  stampDelay?: number | undefined;
  flat?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const pathId = useId().replace(/:/g, "");
  const [m1, m2] = passportMrz(holder, level, graduated);
  const tilt = (e: PointerEvent<HTMLButtonElement>) => {
    if (reduce) return;
    const el = e.currentTarget, r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${(x * 18).toFixed(1)}deg`);
    el.style.setProperty("--rx", `${(-y * 14).toFixed(1)}deg`);
    el.style.setProperty("--mx", (x * 2).toFixed(2));
  };
  const untilt = (e: PointerEvent<HTMLButtonElement>) => { ["--rx", "--ry", "--mx"].forEach((k) => e.currentTarget.style.removeProperty(k)); };

  return (
    <div className={cn("lab-pass-wrap", className)}>
      <button
        type="button"
        className={cn("lv-pass", flat && "flat")}
        aria-label={`Your Web3 Passport: ${holder}, level ${level} of 3, ${passportStatus(level, graduated)}, soulbound on NEAR testnet`}
        onClick={onClick}
        onPointerMove={tilt}
        onPointerLeave={untilt}
      >
        <svg className="guil" viewBox="0 0 330 220" preserveAspectRatio="none" aria-hidden="true">
          {GUILLOCHE.map((g, i) => <path key={i} d={g.d} fill="none" stroke={g.stroke} strokeWidth=".7" />)}
        </svg>
        <span className="holo" aria-hidden="true" />
        <span className="prow brandrow" aria-hidden="true">
          <svg viewBox="0 0 44 42"><rect x="1" y="29" width="42" height="12" rx="6" fill="#d4f033" /><rect x="1" y="15.5" width="36" height="12" rx="6" fill="#a6c21a" /><rect x="1" y="2" width="31" height="12" rx="6" fill="#d4f033" /></svg>
          <b>Bloqvia</b>
        </span>
        <span className="prow kind" aria-hidden="true">WEB3 PASSPORT</span>
        <span className="chipic" aria-hidden="true" />
        <svg className="nfc" viewBox="0 0 14 20" aria-hidden="true"><path d="M2 4 C6 7 6 13 2 16 M6 2 C11 6 11 14 6 18 M10 1 C15 6 15 14 10 19" fill="none" stroke="#f6f3ec" strokeWidth="1.6" strokeLinecap="round" /></svg>
        <span className="fields" aria-hidden="true">
          <span className="wide"><small>Holder</small><i>{holder}</i></span>
          <span><small>Level</small><i>{level} / 3</i></span>
          <span><small>Status</small><i>{passportStatus(level, graduated)}</i></span>
          <span className="wide"><small>Chain · standard</small><i>NEAR testnet · NEP-171 · soulbound</i></span>
        </span>
        <svg className="seal" viewBox="0 0 100 100" aria-hidden="true" style={{ overflow: "visible" }}>
          <defs><path id={pathId} d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0" /></defs>
          <g className="spinner" opacity={sealed ? 1 : 0.35}><text fontFamily="JetBrains Mono, monospace" fontSize="8.6" fontWeight="700" letterSpacing="2.6" fill="#d4f033"><textPath href={`#${pathId}`}>EARNED · NOT BOUGHT · VERIFIED ON CHAIN · </textPath></text></g>
          {sealed && (
            <motion.g
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              initial={stampDelay !== undefined && !reduce ? { scale: 1.8, rotate: -30, opacity: 0 } : false}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 16, delay: stampDelay ?? 0 }}
            >
              <circle cx="50" cy="50" r="27" fill="none" stroke="#d4f033" strokeWidth="1.5" strokeDasharray="3 3" />
              <g transform="translate(36 37)"><rect x="0" y="18" width="28" height="8" rx="4" fill="#d4f033" /><rect x="0" y="9" width="24" height="8" rx="4" fill="#a6c21a" /><rect x="0" y="0" width="20" height="8" rx="4" fill="#d4f033" /></g>
            </motion.g>
          )}
        </svg>
        <span className="mrz" aria-hidden="true">{m1}<br />{m2}</span>
        <span className="scan" aria-hidden="true" />
      </button>
    </div>
  );
}
