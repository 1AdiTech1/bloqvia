import { useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { AfterSeasons } from "@/near";
import { PlayAgainSheet } from "./PlayAgainSheet";

const ACT = "min-h-10 shrink-0 font-display text-[13.5px] font-semibold text-lime inline-flex items-center";

function Row({ done, label, action }: { done: boolean; label: string; action?: ReactNode }) {
  return (
    <li className="grid min-h-10 grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 text-sm">
      {done
        ? <span aria-hidden="true" className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-lime text-[11px] font-bold text-navy">✓</span>
        : <span aria-hidden="true" className="h-[18px] w-[18px] rounded-full border-[1.5px] border-dashed border-lavender" />}
      <span className={done ? "text-lavender" : "text-ivory"}>{label}</span>
      {done ? <span className="text-lime" aria-label="done">✓</span> : action}
    </li>
  );
}

/** "Every day on Bloqvia" (prompt 26): what's left to do today once both seasons are done. */
export function AfterSeasonsCard({ after, onCheckIn, onPlay, onPlaySponsored }: { after: AfterSeasons; onCheckIn: () => void; onPlay: () => void; onPlaySponsored: () => void }) {
  const [again, setAgain] = useState(false);
  const againBtn = useRef<HTMLButtonElement>(null);
  const allDone = (!after.streak.available || after.streak.done) && (!after.daily.available || after.daily.done) && (!after.sponsored.available || after.sponsored.done) && after.missions.done;
  const close = () => { setAgain(false); requestAnimationFrame(() => againBtn.current?.focus()); };

  return (
    <section className={`rounded-[1.6rem] border border-ivory/10 bg-navy-soft p-5 text-ivory shadow-lift${allDone ? " ring-[1.5px] ring-lime" : ""}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">{allDone ? "All done for today" : "Keep going"}</p>
      <h3 className="mt-1 font-display text-[22px] font-medium tracking-[-0.02em]">{allDone ? "See you tomorrow." : "Every day on Bloqvia"}</h3>
      <ul className="mt-3">
        <Row done label="Season 1 · graduated" />
        <Row done label="Season 2 · stamped on your Passport" />
        {after.streak.available && <Row done={after.streak.done} label="Check in for the community streak" action={<button type="button" onClick={onCheckIn} className={ACT}>Check in ↑</button>} />}
        {after.daily.available && <Row done={after.daily.done} label="Play today's quest" action={<button type="button" onClick={onPlay} className={ACT}>Play ↑</button>} />}
        {after.sponsored.available && <Row done={after.sponsored.done} label="Play the sponsored quest" action={<button type="button" onClick={onPlaySponsored} className={ACT}>Play ↑</button>} />}
        <Row done={after.missions.done} label="Take on a mission (graduates)" action={<Link to="/cohort" className={ACT}>Missions →</Link>} />
      </ul>
      <p className="mt-3 text-[13px] text-lavender">{allDone ? "A new quest arrives every day, and the streak needs you again next Bloqvia day." : "Your Passport keeps everything. Nothing here resets it."}</p>
      <button ref={againBtn} type="button" onClick={() => setAgain(true)} aria-haspopup="dialog" className="mt-2 min-h-10 font-display text-[13.5px] font-semibold text-lavender underline underline-offset-4">Play again from zero</button>
      <PlayAgainSheet open={again} onClose={close} />
    </section>
  );
}
