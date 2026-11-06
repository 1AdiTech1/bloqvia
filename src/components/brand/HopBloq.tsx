import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Bloq, SpeechBubble, useSay, talkMs, type BloqHandle, type BloqHat, type BloqProp, type BloqPose } from "@/bloq";

/** True while the media query matches (false during SSR and the first paint). */
export function useMedia(query: string) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setOn(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return on;
}

export type HopLook = { hat: BloqHat; prop?: BloqProp };

/**
 * Phones: Bloq sits on the top edge of one stacked card at a time and hops
 * down to the card nearest 45% of the viewport while the player scrolls.
 * Render inside the cards' positioned container; cards carry `data-hop` and `data-say`.
 */
export function HopBloq({ base, looks, onActive, tone = "dark", label }: { base: HopLook; looks?: HopLook[]; onActive?: (i: number) => void; tone?: "dark" | "light"; label: string }) {
  const reduce = useReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const bloq = useRef<BloqHandle>(null);
  const [line, say] = useSay();
  const [quiet, setQuiet] = useState(false);
  const [pose, setPose] = useState<BloqPose>("sit");
  const [look, setLook] = useState<HopLook>(base);
  const st = useRef({ idx: -1, started: false, timers: [] as number[] });
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const activeRef = useRef(onActive);
  activeRef.current = onActive;
  const looksRef = useRef(looks);
  looksRef.current = looks;

  useEffect(() => {
    const el = host.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const s = st.current;
    const cards = () => Array.from(box.querySelectorAll<HTMLElement>("[data-hop]"));
    const place = (i: number, animate: boolean) => {
      const card = cards()[i];
      if (!card) return;
      el.style.transition = animate ? "transform .55s cubic-bezier(.34,1.3,.64,1)" : "none";
      el.style.transform = `translateY(${card.offsetTop - el.offsetHeight * 0.75 + 4}px)`;
    };
    const dress = (i: number) => {
      const l = looksRef.current?.[i];
      if (l) setLook(l);
      activeRef.current?.(i);
    };
    const speak = (i: number) => {
      const t = cards()[i]?.dataset["say"];
      if (!t) return;
      setQuiet(false);
      say(t);
      bloq.current?.talk(talkMs(t));
    };
    const nearest = () => {
      const mid = window.innerHeight * 0.45;
      let best = 0, d = Infinity;
      cards().forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const dd = Math.abs(r.top + r.height / 2 - mid);
        if (dd < d) { d = dd; best = i; }
      });
      return best;
    };
    const clear = () => { s.timers.forEach((t) => window.clearTimeout(t)); s.timers = []; };
    const seat = (i: number) => { clear(); s.idx = i; place(i, false); setPose("sit"); dress(i); speak(i); };
    const hop = (i: number) => {
      clear();
      s.idx = i;
      if (reduceRef.current) { seat(i); return; }
      setQuiet(true);
      setPose("idle");
      bloq.current?.jump();
      s.timers.push(
        window.setTimeout(() => { place(i, true); dress(i); }, 120),
        window.setTimeout(() => { setPose("sit"); speak(i); }, 640),
      );
    };

    place(0, false); // already on the first card before the section shows
    let raf = 0;
    const onScroll = () => {
      if (raf || !s.started) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const i = nearest();
        if (i !== s.idx) hop(i);
      });
    };
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting && !s.started) { s.started = true; seat(nearest()); }
    }), { threshold: 0.2 });
    io.observe(box);
    const onResize = () => { if (s.idx >= 0) place(s.idx, false); else place(0, false); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      io.disconnect(); clear();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [say]);

  return (
    <div
      ref={host}
      className="absolute right-3 top-0 z-[3] w-[86px] cursor-pointer"
      onClick={() => bloq.current?.jump()}
    >
      <div className="relative">
        <Bloq ref={bloq} hat={look.hat} {...(look.prop ? { prop: look.prop } : {})} pose={pose} label={label} className="w-full" />
        <SpeechBubble text={quiet ? null : line} tone={tone} className="hop-say" />
      </div>
    </div>
  );
}
