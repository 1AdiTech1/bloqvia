/**
 * <ChainTrail/> — the journey map as a NEAR world.
 *
 * An isometric floor with validator towers and chain chunks drifting up; a road paved with block
 * tiles that light up lime as the player advances, validator lamps on both sides and transactions
 * travelling along it; three quest blocks drawn as what they teach (a vault, a battery station, a
 * contract machine); Bloq the guide standing at the current stop; Bloq the merchant behind the
 * shop door at the end of the road. Ported from docs/design/game-v2/index.html.
 *
 *   <ChainTrail
 *     stops={[{ id, title: "The Vault", kind: "vault", post: "keys · ed25519", reward: <ItemIcon id="key-fragment" /> }, …]}
 *     level={trailLevel}               // quests done, 0–3. When it goes up, Bloq walks to the next stop.
 *     onPlay={(i) => openQuest(i)}     // the glowing block was tapped
 *     doorAccount="bloq.bloqvia.testnet"
 *     blockHeight={useFinalBlock()}    // the ticker; null hides the number
 *     door={<>…Enter Bloq's shop button, Ask Bloq link…</>}
 *   />
 *
 * Raise `level` after the quest sheet closes (not while it is open), so the walk happens in view.
 * The component never reads game state itself; the screen passes what it shows.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Bloq, type BloqHandle } from "./Bloq";
import { SpeechBubble, useSay, talkMs } from "./SpeechBubble";

export type QuestKind = "vault" | "battery" | "contract";
export interface TrailStop {
  id: string;
  title: string;
  kind: QuestKind;
  /** The signpost under the label, in mono: "keys · ed25519", "gas · the relayer pays", "core.bloqvia.testnet". */
  post: string;
  /** Small icon shown in the badge on a finished block (the reward item). */
  reward?: ReactNode;
}
export interface ChainTrailProps {
  stops: readonly [TrailStop, TrailStop, TrailStop];
  level: number;
  onPlay: (index: number) => void;
  doorAccount?: string;
  /** Defaults to level >= 3. */
  doorOpen?: boolean;
  /** Rendered under the door (button, link, line of text). */
  door?: ReactNode;
  network?: string;
  blockHeight?: number | null;
  /** Bloq's line when tapped (and on first view). Defaults to the preview's lines. */
  tip?: (level: number, stops: ChainTrailProps["stops"]) => string;
  /** Say the tip once when the trail first comes into view. */
  intro?: boolean;
  className?: string;
}
export interface ChainTrailHandle {
  /** Bloq says a line on the map. */
  say(text: string): void;
}

const HEIGHT = 820;
const STOP_X = [0.27, 0.73, 0.29, 0.5] as const;
const STOP_Y = [70, 245, 405, 680] as const;
const TOWERS: readonly (readonly [number, number, string])[] = [[0.88, 110, "validator"], [0.1, 290, ""], [0.9, 450, "validator"], [0.88, 740, ""]];
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function defaultTip(level: number, stops: ChainTrailProps["stops"]): string {
  if (level <= 0) return `Hi, I'm Bloq. Tap the first block and we'll open ${stops[0].title}.`;
  if (level < 3) return `Next up: ${stops[level]?.title ?? "the next quest"}. Tap the glowing block.`;
  return "All done! Go on in.";
}

function pathD(w: number): string {
  const x = STOP_X.map((f) => f * w), y = STOP_Y;
  return `M${x[0]} ${y[0]} C ${x[0]} ${y[0] + 90}, ${x[1]} ${y[1] - 90}, ${x[1]} ${y[1]} S ${x[2]} ${y[2] - 90}, ${x[2]} ${y[2]} S ${x[3]} ${y[3] - 80}, ${x[3]} ${y[3]}`;
}

/* ---------- the quest blocks: line art on a 100×100 square, mapped onto the cube's three faces ---------- */
const FACE = { L: "matrix(.37 .18 0 .38 6 24)", R: "matrix(.37 -.18 0 .38 43 42)", T: "matrix(.37 -.18 .37 .18 6 24)" } as const;
type BlockState = "done" | "avail" | "locked";

function QuestBlock({ kind, state }: { kind: QuestKind; state: BlockState }) {
  const done = state === "done", locked = state === "locked";
  const c = done ? ["#ecfa8f", "#d4f033", "#a6c21a"] : state === "avail" ? ["#fffdf7", "#efe9dc", "#d6cfbd"] : ["rgb(27 40 64 / .7)", "rgb(27 40 64 / .55)", "rgb(27 40 64 / .4)"];
  const ink = locked ? "#b9a3e6" : "#121a28";
  const lime = locked ? "none" : done ? "#16243a" : "#d4f033";
  const purple = locked ? "none" : done ? "#16243a" : "#8b45d9";
  const card = locked ? "none" : done ? "#f4fbcf" : "#ffffff";
  const edge = locked
    ? { stroke: "#c9a6f3", strokeOpacity: 0.75, strokeWidth: 1.6, strokeDasharray: "4 4" }
    : { stroke: "#121a28", strokeWidth: 2.4, strokeLinejoin: "round" as const };
  const st = { stroke: ink, strokeWidth: 5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  let L: ReactNode, R: ReactNode, T: ReactNode;
  if (kind === "vault") {
    L = (<>
      <circle cx="50" cy="52" r="34" fill={card} {...st} />
      <circle cx="50" cy="52" r="25" fill="none" {...st} strokeDasharray="4 7" />
      <g className="dial"><circle cx="50" cy="52" r="11" fill={lime} {...st} /><path d="M50 52 L50 30 M50 52 L69 63 M50 52 L31 63" {...st} /></g>
      {[0, 90, 180, 270].map((a) => { const r = (a * Math.PI) / 180; return <circle key={a} cx={50 + Math.cos(r) * 40} cy={52 + Math.sin(r) * 40} r="4" fill={ink} />; })}
    </>);
    R = (<><rect x="14" y="18" width="16" height="16" rx="3" fill={ink} /><rect x="14" y="66" width="16" height="16" rx="3" fill={ink} /><rect x="58" y="34" width="12" height="34" rx="6" fill={lime} {...st} /><path d="M76 22 V78" {...st} strokeDasharray="3 9" /></>);
    T = (<><circle cx="50" cy="44" r="10" fill={ink} /><path d="M45 50 L55 50 L58 70 L42 70 Z" fill={ink} /><rect x="16" y="16" width="68" height="68" rx="8" fill="none" {...st} strokeDasharray="6 8" /></>);
  } else if (kind === "battery") {
    L = (<>
      <rect x="22" y="22" width="56" height="68" rx="9" fill={card} {...st} /><rect x="38" y="10" width="24" height="12" rx="3" fill={ink} />
      <g className="bars"><rect x="31" y="68" width="38" height="13" rx="3" fill={lime} {...st} /><rect x="31" y="50" width="38" height="13" rx="3" fill={lime} {...st} /><rect x="31" y="32" width="38" height="13" rx="3" fill={lime} {...st} /></g>
    </>);
    R = <path d="M60 10 L28 56 H50 L40 92 L76 40 H54 Z" fill={lime} {...st} />;
    T = (<><circle cx="50" cy="50" r="22" fill={card} {...st} /><rect x="40" y="36" width="7" height="16" rx="2" fill={ink} /><rect x="54" y="36" width="7" height="16" rx="2" fill={ink} /><path d="M50 72 C50 84 70 86 80 80" {...st} /></>);
  } else {
    L = (<>
      <rect x="20" y="12" width="52" height="78" rx="5" fill={card} {...st} /><path d="M30 28 H62 M30 40 H58 M30 52 H62 M30 64 H48" {...st} />
      <circle cx="60" cy="76" r="13" fill={purple} {...st} />
      <path d="M54 76 l4 4 l8 -8" fill="none" stroke={locked ? ink : done ? "#d4f033" : "#fff"} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </>);
    R = (<>
      <rect x="14" y="12" width="72" height="34" rx="5" fill={locked ? "none" : "#16243a"} {...st} />
      <text x="50" y="37" textAnchor="middle" fontFamily="JetBrains Mono, ui-monospace, monospace" fontWeight="700" fontSize="20" fill={locked ? ink : "#d4f033"}>fn()</text>
      <rect x="38" y="56" width="24" height="30" rx="4" fill={card} {...st} /><path d="M50 62 V80" {...st} />
    </>);
    T = (<><circle cx="50" cy="50" r="18" fill={lime} {...st} /><circle cx="50" cy="50" r="8" fill="none" {...st} /></>);
  }
  return (
    <svg className="cube" viewBox="0 0 86 86" aria-hidden="true">
      <path d="M43 6 L80 24 L43 42 L6 24 Z" fill={c[0]} {...edge} />
      <path d="M6 24 L43 42 L43 80 L6 62 Z" fill={c[1]} {...edge} />
      <path d="M80 24 L43 42 L43 80 L80 62 Z" fill={c[2]} {...edge} />
      <g opacity={locked ? 0.55 : 1}>
        <g transform={FACE.T}>{T}</g><g transform={FACE.L}>{L}</g><g transform={FACE.R}>{R}</g>
      </g>
    </svg>
  );
}

function Tower() {
  return (
    <svg viewBox="0 0 34 60" aria-hidden="true">
      <path d="M17 40 L32 47 L17 54 L2 47 Z" fill="#2b3d5c" stroke="#121a28" strokeWidth="1.5" />
      <path d="M2 47 L17 54 L17 60 L2 53 Z" fill="#22324c" stroke="#121a28" strokeWidth="1.5" />
      <path d="M32 47 L17 54 L17 60 L32 53 Z" fill="#1a2740" stroke="#121a28" strokeWidth="1.5" />
      <path d="M17 47 L13 12 M17 47 L21 12 M14 30 H20 M13.5 20 H20.5" stroke="#5b6f95" strokeWidth="1.6" strokeLinecap="round" />
      <circle className="beacon" cx="17" cy="9" r="4" fill="#d4f033" /><circle className="beacon" cx="17" cy="9" r="9" fill="rgb(212 240 51 / .25)" />
    </svg>
  );
}

const Check = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Lock = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;

type Pt = { x: number; y: number };
type Lamp = { x: number; y: number; on: boolean };

export const ChainTrail = forwardRef<ChainTrailHandle, ChainTrailProps>(function ChainTrail(
  { stops, level: levelIn, onPlay, doorAccount = "bloq.bloqvia.testnet", doorOpen, door, network = "NEAR testnet", blockHeight = null, tip = defaultTip, intro = true, className },
  ref,
) {
  const level = Math.max(0, Math.min(3, Math.floor(levelIn)));
  const open = doorOpen ?? level >= 3;
  const box = useRef<HTMLDivElement>(null);
  const refPath = useRef<SVGPathElement>(null);
  const walker = useRef<HTMLDivElement>(null);
  const guide = useRef<BloqHandle>(null);
  const merchant = useRef<BloqHandle>(null);
  const txs = useRef<(SVGRectElement | null)[]>([]);
  const [w, setW] = useState(0);
  const [geo, setGeo] = useState<{ len: number; stopLen: number[]; door: Pt } | null>(null);
  const [lamps, setLamps] = useState<Lamp[]>([]);
  const [facing, setFacing] = useState<"left" | "right">("left");
  const [line, sayRaw] = useSay();
  const at = useRef(level);            // the stop Bloq is standing at
  const walkingRef = useRef(false);
  const timers = useRef<number[]>([]);

  const say = useCallback((text: string) => { sayRaw(text); guide.current?.talk(talkMs(text)); }, [sayRaw]);
  useImperativeHandle(ref, () => ({ say }), [say]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  // width → geometry
  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    const measure = () => setW(el.clientWidth || 360);
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const p = refPath.current; if (!p || !w) return;
    const len = p.getTotalLength();
    const stopLen = STOP_X.map((fx, i) => {
      let best = 0, bd = Infinity;
      for (let L = 0; L <= len; L += 2) { const q = p.getPointAtLength(L), d = Math.hypot(q.x - fx * w, q.y - (STOP_Y[i] ?? 0)); if (d < bd) { bd = d; best = L; } }
      return best;
    });
    const end = p.getPointAtLength(stopLen[3] ?? len);
    setGeo({ len, stopLen, door: { x: end.x, y: end.y } });
  }, [w]);

  const pointAt = (L: number): Pt => { const p = refPath.current?.getPointAtLength(L); return p ? { x: p.x, y: p.y } : { x: 0, y: 0 }; };
  const rest = useCallback((i: number): Pt & { face: "left" | "right" } => {
    if (!geo) return { x: 0, y: 0, face: "right" };
    if (i >= 3) { const p = pointAt(geo.stopLen[3] ?? 0); return { x: p.x - 104, y: p.y + 10, face: "right" }; }
    const p = pointAt(geo.stopLen[i] ?? 0), right = (STOP_X[i] ?? 0.5) < 0.5;
    return { x: p.x + (right ? 80 : -80), y: p.y + 40, face: right ? "left" : "right" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);
  const place = (x: number, y: number) => { if (walker.current) walker.current.style.transform = `translate(${x - 44}px, ${y - 117}px)`; };

  // lamps along both sides, lit up to where the player has reached
  useLayoutEffect(() => {
    if (!geo) return;
    const prog = geo.stopLen[level] ?? geo.len, out: Lamp[] = [];
    for (let L = 36, k = 0; L < geo.len - 10; L += 58, k++) {
      const p = pointAt(L), q = pointAt(Math.min(geo.len, L + 1)), dx = q.x - p.x, dy = q.y - p.y, n = Math.hypot(dx, dy) || 1, side = k % 2 ? 1 : -1;
      out.push({ x: p.x + (-dy / n) * 27 * side, y: p.y + (dx / n) * 27 * side, on: L <= prog + 2 });
    }
    setLamps(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, level]);

  // Bloq stands at his stop; when `level` goes up he walks the road to the new one
  useLayoutEffect(() => {
    if (!geo || walkingRef.current) return;
    if (level <= at.current || reduced()) {
      at.current = level; const r = rest(level); place(r.x, r.y); setFacing(r.face); return;
    }
    const from = at.current, to = level;
    walkingRef.current = true;
    let cancelled = false;
    const anim = (ms: number, step: (k: number) => void) => new Promise<void>((res) => {
      const t0 = performance.now();
      const tick = (now: number) => { if (cancelled) return res(); const k = Math.min(1, (now - t0) / ms); step(k); k < 1 ? requestAnimationFrame(tick) : res(); };
      requestAnimationFrame(tick);
    });
    const glide = async (a: Pt, b: Pt, ms: number) => { setFacing(b.x >= a.x ? "right" : "left"); await anim(ms, (k) => place(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k)); };
    (async () => {
      walker.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      await new Promise((r) => timers.current.push(window.setTimeout(r, 500)));
      guide.current?.walking(true);
      for (let i = from + 1; i <= to && !cancelled; i++) {
        const a = rest(i - 1), L0 = geo.stopLen[i - 1] ?? 0, L1 = geo.stopLen[i] ?? 0, s0 = pointAt(L0);
        await glide(a, { x: s0.x, y: s0.y + 8 }, 420);
        let face: "left" | "right" = "right";
        await anim(Math.max(1400, (L1 - L0) * 7.5), (k) => {
          const L = L0 + (L1 - L0) * k, p = pointAt(L), q = pointAt(Math.min(geo.len, L + 3)), f = q.x >= p.x ? "right" : "left";
          if (f !== face) { face = f; setFacing(f); }
          place(p.x, p.y + 8);
        });
        const s1 = pointAt(L1), r = rest(i);
        await glide({ x: s1.x, y: s1.y + 8 }, r, 420);
        at.current = i;
      }
      guide.current?.walking(false);
      const r = rest(to); setFacing(r.face); walkingRef.current = false;
      if (cancelled) return;
      guide.current?.jump();
      say(tip(to, stops));
      if (to >= 3) timers.current.push(window.setTimeout(() => { merchant.current?.jump(); merchant.current?.setMood("laugh", 1200); }, 1500));
    })();
    return () => { cancelled = true; walkingRef.current = false; guide.current?.walking(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, level]);

  // say hello once, the first time the trail is on screen
  useEffect(() => {
    const el = box.current; if (!el || !intro) return;
    let done = false;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting && !done) { done = true; timers.current.push(window.setTimeout(() => say(tip(at.current, stops)), 600)); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro]);

  // transactions travelling the chain (paused off screen, in a hidden tab, or with reduced motion)
  useEffect(() => {
    if (!geo || reduced()) return;
    const el = box.current; let on = true, raf = 0, last = 0;
    const T = [{ L: 0, v: 0.055 }, { L: geo.len * 0.35, v: 0.04 }, { L: geo.len * 0.7, v: 0.07 }];
    const io = new IntersectionObserver(([e]) => { on = !!e?.isIntersecting; }); if (el) io.observe(el);
    const loop = (now: number) => {
      const dt = last ? Math.min(50, now - last) : 16; last = now;
      if (on && !document.hidden) T.forEach((t, i) => {
        t.L = (t.L + t.v * dt) % geo.len; const p = pointAt(t.L), r = txs.current[i];
        if (r) { r.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(45) translate(-4 -4)`); r.style.opacity = t.L < 30 || t.L > geo.len - 30 ? "0" : "1"; }
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  const d = w ? pathD(w) : "";
  const prog = geo ? geo.stopLen[level] ?? geo.len : 0;
  return (
    <div className={["bloq-trail-wrap", className ?? ""].join(" ")}>
      <span className="bloq-ticker" aria-label={`${network} block height`}>
        <i key={blockHeight ?? 0} aria-hidden="true" />{network}{blockHeight !== null ? <> · block <b>{blockHeight.toLocaleString("en-US")}</b></> : null}
      </span>
      <div ref={box} className="bloq-trail" style={{ height: HEIGHT }}>
        <div className="world" aria-hidden="true">
          {TOWERS.map(([x, y, t], i) => (
            <span key={i} className="tower" style={{ left: `calc(${x * 100}% + ${(0.5 - x) * 32}px)`, top: y + 14 }}><Tower />{t ? <small>{t}</small> : null}</span>
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className={`chunk${i % 3 === 0 ? " l" : ""}`} style={{ left: `${6 + ((i * 37) % 88)}%`, "--t": `${18 + (i % 4) * 5}s`, "--d": `-${i * 2.3}s` } as CSSProperties} />
          ))}
        </div>

        <svg className="road" viewBox={`0 0 ${w || 360} ${HEIGHT}`} aria-hidden="true">
          <defs><mask id="bloq-trail-lit" maskUnits="userSpaceOnUse"><path className="p-mask" d={d} style={geo ? { strokeDasharray: geo.len, strokeDashoffset: geo.len - prog } : undefined} /></mask></defs>
          <path className="p-rim" d={d} /><path className="p-edge" d={d} /><path className="p-base" d={d} /><path className="p-tiles" d={d} />
          <path className="p-lit" d={d} mask="url(#bloq-trail-lit)" /><path className="p-chain" d={d} />
          <g>{lamps.map((l, i) => (
            <g key={i} className={`lamp${l.on ? " on" : ""}`}><line x1={l.x} y1={l.y} x2={l.x} y2={l.y - 9} /><circle className="glow" cx={l.x} cy={l.y - 11} r="7" /><circle className="dot" cx={l.x} cy={l.y - 11} r="3" /></g>
          ))}</g>
          <g>{[0, 1, 2].map((i) => <rect key={i} ref={(n) => { txs.current[i] = n; }} className={`tx${i === 1 ? " p" : ""}`} width="8" height="8" rx="1.5" style={{ opacity: 0 }} />)}</g>
          <path ref={refPath} d={d} fill="none" stroke="none" />
        </svg>

        {w > 0 && stops.map((s, i) => {
          const state: BlockState = i < level ? "done" : i === level ? "avail" : "locked";
          return (
            <div key={s.id} className={`stop ${state}`} style={{ left: (STOP_X[i] ?? 0.5) * w, top: STOP_Y[i] }}>
              <button type="button" className="blk" disabled={state !== "avail"} onClick={() => onPlay(i)} aria-label={`${s.title}: ${state === "done" ? "done" : state === "avail" ? "play" : "locked"}`}>
                <QuestBlock kind={s.kind} state={state} />
                <span className="mark">{state === "done" ? <Check /> : state === "avail" ? `0${i + 1}` : <Lock />}</span>
                {state === "done" && s.reward ? <span className="badge">{s.reward}</span> : null}
              </button>
              <span className="lbl">{s.title}</span>
              <span className="post">{s.post}</span>
            </div>
          );
        })}

        {geo ? (
          <div className={`door${open ? " open" : ""}`} style={{ left: geo.door.x, top: geo.door.y - 118 }}>
            <div className="arch-wrap">
              <span className="plate">{doorAccount}</span>
              <div className="arch">
                <div className="inside" />
                <div className="merchant"><Bloq ref={merchant} hat="tophat" prop="cube" pose="wave" label="Bloq the merchant, waving from his shop" /></div>
                <div className="awn" />
                <div className="leaf"><Lock /></div>
              </div>
            </div>
            {door}
          </div>
        ) : null}

        <div ref={walker} className="walker" onClick={() => { guide.current?.jump(); say(tip(at.current, stops)); }}>
          <Bloq ref={guide} hat="cap" pose="idle" facing={facing} label="Bloq, your guide on the map" />
          <SpeechBubble text={line} tone="light" />
        </div>
      </div>
    </div>
  );
});
