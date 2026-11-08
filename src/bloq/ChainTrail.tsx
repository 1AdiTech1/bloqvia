/**
 * <ChainTrail/> — the journey map as a NEAR world.
 *
 * An isometric floor with validator towers and chain chunks drifting up; a road paved with block
 * tiles that light up lime as the player advances, validator lamps on both sides and transactions
 * travelling along it; three quest blocks drawn as what they teach (a vault, a battery station, a
 * contract machine); Bloq the guide standing at the current stop; Bloq the merchant behind the
 * shop door at the end of the road. Ported from docs/design/game-v2/index.html.
 * The road runs from the side of one block to the side of the next, fades out before each block and
 * carries on into it as three stepping stones (docs/design/roads, F). At the foot of the map: an
 * orchard of Merkle trees in Season 1 (docs/design/fields-scenery, C), a skyline in Season 2.
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
import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Bloq, type BloqHandle, type BloqHat, type BloqProp } from "./Bloq";
import { SpeechBubble, useSay, talkMs } from "./SpeechBubble";

/** Season 1: vault (keys), battery (gas), contract. Season 2: ownership (tokens/NFTs), transfer (signed transactions), pool (DeFi pricing). */
export type QuestKind = "vault" | "battery" | "contract" | "ownership" | "transfer" | "pool";
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
  /** The whole stage is not open yet: every block locked, no guide on the road, the door shut. */
  locked?: boolean;
  /** The look of the land: "fields" (Season 1: block fields and validator towers, the default) or "city" (Season 2: the network city at dusk). */
  world?: "fields" | "city";
  /** Is the guide on this road? "gone" while he's in the other season. Default "here". Moving between roads: `jumpTo` and `greet` on the handle. */
  guideAt?: "here" | "gone";
  /** The host has gone inside behind a curtain (the next season has started). Hover, focus or tap the door and he peeks out with `hostHello`. */
  curtain?: boolean;
  hostHello?: string;
  /** Called when the guide has finished walking to a new stop (for the shop: after the cheer with the merchant). */
  onArrived?: (level: number) => void;
  /** Show the "NEAR testnet · block …" pill above the road. Off when the page shows it elsewhere (in the season card). Default true. */
  ticker?: boolean;
  /** Number shown on the first block (1 for Season 1, 4 for Season 2). Default 1. */
  firstNumber?: number;
  /** Who waits behind the door at the end of the road. Defaults to Bloq the merchant (top hat, cube). */
  host?: { hat: BloqHat; prop: BloqProp | null; label: string };
  className?: string;
}
export interface ChainTrailHandle {
  /** Bloq says a line on the map. */
  say(text: string): void;
  /** Bloq and the host at the door cheer together, then Bloq says `line` (default: the tip for the finished road). E.g. when the Passport is stamped. */
  cheer(line?: string): void;
  /** Where the guide stands at the first block, in viewport coordinates (for another trail to jump to). */
  entry(): { x: number; y: number } | null;
  /** The guide says `line`, then jumps in one arc to `to` (viewport coordinates, e.g. the next season's `entry()`) and leaves this road. */
  jumpTo(to: { x: number; y: number }, line?: string): Promise<void>;
  /** The guide hops and says his tip for where he stands (e.g. right after landing on this road). */
  greet(): void;
  /** The guide walks from where he is to `to` (viewport coordinates of a seat, e.g. the top edge of the next season's card),
   *  sits on the edge and says `line`. He goes round the shop and its text, never over it. `instant` places him there at once. */
  perchAt(to: { x: number; y: number }, line?: string, instant?: boolean, sit?: boolean): Promise<void>;
}

const HEIGHT = 820;
const STOP_X = [0.27, 0.73, 0.29, 0.5] as const;
const STOP_Y = [70, 245, 405, 680] as const;
// The foot of the map is the orchard (Season 1) or the skyline (Season 2), so no tower stands down there.
const TOWERS: readonly (readonly [number, number, string])[] = [[0.88, 110, "validator"], [0.1, 290, ""], [0.9, 450, "validator"]];
/** The road fades out round each block (an ellipse on its centre, fully gone inside `core` of it); the stepping stones
 *  carry on into the block: [distance along the road from the block's centre, half-width]. Nov 9, docs/design/roads (F). */
const FADE = { rx: 124, ry: 86, core: 0.8 } as const;
const STONES = [[92, 9], [72, 7.5], [54, 6]] as const;
const MERCHANT = { hat: "tophat", prop: "cube", label: "Bloq the merchant, waving from his shop" } as const satisfies ChainTrailProps["host"];
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function defaultTip(level: number, stops: ChainTrailProps["stops"]): string {
  if (level <= 0) return `Hi, I'm Bloq. Tap the first block and we'll open ${stops[0].title}.`;
  if (level < 3) return `Next up: ${stops[level]?.title ?? "the next quest"}. Tap the glowing block.`;
  return "All done! Go on in.";
}

/** The road leaves each block sideways, level with its foot, and crosses to the side of the next one, then down into the shop.
 *  It still passes through every block's centre (hidden there by the fade), so the guide's walk and the progress light work as before. */
function pathD(w: number): string {
  const [x0, x1, x2, x3] = STOP_X.map((f) => f * w) as [number, number, number, number], [y0, y1, y2, y3] = STOP_Y;
  const k01 = Math.max(70, (x1 - x0) * 0.55), k12 = Math.max(70, (x1 - x2) * 0.55);
  return `M${x0} ${y0} C ${x0 + k01} ${y0}, ${x1 - k01} ${y1}, ${x1} ${y1} C ${x1 - k12} ${y1}, ${x2 + k12} ${y2}, ${x2} ${y2} C ${x2 + 120} ${y2}, ${x3} ${y3 - 130}, ${x3} ${y3}`;
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
  } else if (kind === "ownership") {
    // an NFT card with its picture, a ribbon badge, a gem on top
    L = (<>
      <rect x="18" y="10" width="64" height="80" rx="8" fill={card} {...st} />
      <rect x="27" y="19" width="46" height="34" rx="4" fill={purple} {...st} />
      <path d="M29 51 L42 36 L52 45 L60 38 L71 51" fill={lime} {...st} /><circle cx="62" cy="28" r="4" fill={lime} {...st} strokeWidth={3} />
      <path d="M30 66 H70 M30 78 H54" {...st} />
    </>);
    R = (<>
      <path d="M40 54 L33 88 L45 80 L50 90 L55 80 L67 88 L60 54 Z" fill={purple} {...st} />
      <circle cx="50" cy="40" r="22" fill={lime} {...st} /><circle cx="50" cy="40" r="11" fill="none" {...st} />
    </>);
    T = <path d="M28 42 L41 26 H59 L72 42 L50 74 Z M28 42 H72 M41 26 L50 42 L59 26" fill={lime} {...st} />;
  } else if (kind === "transfer") {
    // a signed envelope (the wax seal is the signature), a send arrow, a final check on top
    L = (<>
      <rect x="12" y="24" width="76" height="54" rx="6" fill={card} {...st} />
      <path d="M13 28 L50 56 L87 28" fill="none" {...st} />
      <g className="seal"><circle cx="50" cy="64" r="11" fill={purple} {...st} />
      <path d="M45 64 l4 4 l7 -7" fill="none" stroke={locked ? ink : done ? "#d4f033" : "#fff"} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></g>
    </>);
    R = (<><path d="M12 50 H22 M28 50 H34" {...st} /><path d="M40 40 H58 V26 L88 50 L58 74 V60 H40 Z" fill={lime} {...st} /></>);
    T = (<><circle cx="50" cy="50" r="22" fill={lime} {...st} /><path d="M39 51 l8 8 l15 -16" fill="none" {...st} /></>);
  } else if (kind === "pool") {
    // the price curve (the more Bloq holds, the less he pays), a balance, a liquidity pool on top
    L = (<>
      <rect x="12" y="10" width="76" height="80" rx="6" fill={card} {...st} />
      <path d="M24 20 V78 H80" fill="none" {...st} />
      <path className="curve" d="M28 24 C 36 58, 50 68, 78 72" fill="none" stroke={locked ? ink : "#8b45d9"} strokeWidth="6" strokeLinecap="round" />
      <circle cx="33" cy="42" r="5" fill={lime} {...st} strokeWidth={3} /><circle cx="48" cy="61" r="5" fill={lime} {...st} strokeWidth={3} /><circle cx="68" cy="70" r="5" fill={lime} {...st} strokeWidth={3} />
    </>);
    R = (<>
      <path d="M50 18 V82 M34 84 H66 M18 32 H82" {...st} />
      <path d="M18 32 L8 56 H28 Z M82 32 L72 56 H92 Z" fill={lime} {...st} />
    </>);
    T = (<><circle cx="50" cy="50" r="27" fill={purple} {...st} /><path d="M28 52 Q 39 43 50 52 T 72 52" fill="none" stroke={card === "none" ? ink : card} strokeWidth="5" strokeLinecap="round" /></>);
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

/** Season 2 backdrop: isometric towers of the network city, lit windows. */
function Skyline() {
  const B: [number, number, number][] = [[2, 70, 24], [9, 110, 30], [17, 54, 22], [74, 92, 26], [82, 130, 32], [91, 62, 22], [44, 46, 18], [58, 76, 20]];
  return (
    <svg className="skyline" viewBox="0 0 100 160" preserveAspectRatio="none" aria-hidden="true">
      {B.map(([x, h, w], i) => (
        <g key={i} transform={`translate(${x} ${160 - h})`}>
          <rect width={w / 3} height={h} fill={i % 2 ? "#251a4a" : "#2c2058"} />
          {Array.from({ length: Math.floor(h / 14) }, (_, r) => (
            <rect key={r} className={`win${(r + i) % 3 === 0 ? " on" : ""}`} x={w / 3 / 2 - 1.2} y={6 + r * 14} width="2.4" height="4" rx=".6" />
          ))}
        </g>
      ))}
    </svg>
  );
}

/** One Merkle tree: four hash leaves paired up into two, then into the root, on a mound. Dark like the skyline, the leaves dim lights. */
function MerkleTree({ x, y, s, seed }: { x: number; y: number; s: number; seed: number }) {
  const root = { x, y: y - 26 * s }, rise = 22 * s;
  const lv1 = [-1, 1].map((d) => ({ x: x + (d * 30 * s) / 1.6, y: root.y - rise }));
  const lv2 = lv1.flatMap((p) => [-1, 1].map((d) => ({ x: p.x + (d * 15 * s) / 1.4, y: p.y - rise })));
  const node = (p: { x: number; y: number }, r: number, fill: string, cls?: string) => (
    <rect className={cls} x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} rx={r * 0.35} fill={fill} stroke="#16213a" strokeWidth="1" />
  );
  const leaf = (i: number) => ((i + seed) % 3 === 0 ? ["rgb(212 240 51 / .55)", "light"] : (i + seed) % 3 === 1 ? ["rgb(201 166 243 / .22)", undefined] : ["#22324c", undefined]) as [string, string | undefined];
  return (
    <g>
      <ellipse cx={x} cy={y + 2} rx={30 * s} ry={9 * s} fill="#1a2740" stroke="rgb(201 166 243 / .07)" strokeWidth="1" />
      <line x1={x} y1={y} x2={root.x} y2={root.y} stroke="#2a3a58" strokeWidth={3 * s} strokeLinecap="round" />
      {lv1.map((p, i) => <line key={i} x1={root.x} y1={root.y} x2={p.x} y2={p.y} stroke="#2a3a58" strokeWidth={2 * s} />)}
      {lv2.map((p, i) => <line key={i} x1={lv1[i >> 1]!.x} y1={lv1[i >> 1]!.y} x2={p.x} y2={p.y} stroke="#2a3a58" strokeWidth={1.4 * s} />)}
      {lv2.map((p, i) => <g key={i}>{node(p, 5.5 * s, ...leaf(i))}</g>)}
      {lv1.map((p, i) => <g key={i}>{node(p, 4.5 * s, "#22324c")}</g>)}
      {node(root, 5 * s, "rgb(212 240 51 / .55)", "light root")}
    </g>
  );
}

/** Season 1 backdrop: an orchard of Merkle trees behind a fence of chain links, fading into the floor at the top and dim
 *  behind the shop door, so the door's text stays readable. Drawn in pixels across the world (the trail plus 16px each side). */
function Orchard({ w }: { w: number }) {
  const id = `bloq-orchard-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const W = w + 32, phone = W < 500, s = phone ? 1.15 : 1.5, fy = 292;
  const trees: [number, number, number, number][] = phone
    ? [[0.08, 190, 1, 1], [0.92, 200, 0.95, 0], [0.2, 258, 0.75, 2], [0.8, 262, 0.7, 1]]
    : [[0.07, 200, 1, 1], [0.2, 160, 0.9, 2], [0.32, 248, 0.7, 0], [0.8, 168, 1, 0], [0.93, 214, 0.85, 2], [0.68, 252, 0.7, 1]];
  return (
    <svg className="orchard" viewBox={`0 0 ${W} 300`} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-v`} x1="0" y1="0" x2="0" y2="1"><stop offset=".02" stopColor="#fff" stopOpacity="0" /><stop offset=".17" stopColor="#fff" /></linearGradient>
        <radialGradient id={`${id}-c`}><stop offset="0" stopColor="#000" stopOpacity=".62" /><stop offset=".7" stopColor="#000" stopOpacity=".35" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height="300">
          <rect width={W} height="300" fill={`url(#${id}-v)`} />
          <ellipse cx={W / 2} cy="190" rx={phone ? 125 : 150} ry="130" fill={`url(#${id}-c)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}-m)`}>
        <path d={`M0 300 L0 ${fy - 40} Q ${W * 0.25} ${fy - 62} ${W * 0.5} ${fy - 44} T ${W} ${fy - 50} L${W} 300 Z`} fill="#172236" stroke="rgb(201 166 243 / .07)" strokeWidth="1.2" />
        {[...trees].sort((a, b) => a[1] - b[1]).map(([fx, y, k, seed], i) => <MerkleTree key={i} x={W * fx} y={y} s={s * k} seed={seed} />)}
        {Array.from({ length: Math.floor(W / 30) + 1 }, (_, i) => {
          const x = 6 + i * 30;
          return (
            <g key={i}>
              <rect x={x - 2.5} y={fy - 18} width="5" height="18" rx="1" fill="#22324c" stroke="#16213a" strokeWidth=".8" />
              {[0, 1, 2].map((k) => <ellipse key={k} cx={x + 7.5 + k * 7.5} cy={fy - 10} rx="4.6" ry="2.8" fill="none" stroke="#2a3a58" strokeWidth="1.4" />)}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** Season 2's towers: RPC nodes and indexers, a small building with an antenna. */
function Node() {
  return (
    <svg viewBox="0 0 34 60" aria-hidden="true">
      <path d="M17 38 L32 45 L17 52 L2 45 Z" fill="#3a2a66" stroke="#121a28" strokeWidth="1.5" />
      <path d="M2 45 L17 52 L17 60 L2 53 Z" fill="#2c2058" stroke="#121a28" strokeWidth="1.5" />
      <path d="M32 45 L17 52 L17 60 L32 53 Z" fill="#221947" stroke="#121a28" strokeWidth="1.5" />
      <path d="M6 44 V24 L17 19 L28 24 V44" fill="#2c2058" stroke="#121a28" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 28 H14 M20 28 H24 M10 35 H14 M20 35 H24" stroke="#c9a6f3" strokeWidth="2" strokeLinecap="round" opacity=".8" />
      <path d="M17 19 V8" stroke="#8f7bb8" strokeWidth="1.6" strokeLinecap="round" />
      <circle className="beacon" cx="17" cy="6" r="3.5" fill="#c9a6f3" /><circle className="beacon" cx="17" cy="6" r="8" fill="rgb(201 166 243 / .25)" />
    </svg>
  );
}

/** "NEAR testnet · block 276,622,703": the latest final block, ticking. Also for use outside the trail (season cards). */
export function BlockTicker({ network = "NEAR testnet", blockHeight, className }: { network?: string; blockHeight: number | null; className?: string }) {
  return (
    <span className={["bloq-ticker", className ?? ""].join(" ")} aria-label={`${network} block height`}>
      <i key={blockHeight ?? 0} aria-hidden="true" />{network}{blockHeight !== null ? <> · block <b>{blockHeight.toLocaleString("en-US")}</b></> : null}
    </span>
  );
}

const Check = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Lock = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;

type Pt = { x: number; y: number };
type Lamp = { x: number; y: number; on: boolean };

export const ChainTrail = forwardRef<ChainTrailHandle, ChainTrailProps>(function ChainTrail(
  { stops, level: levelIn, onPlay, doorAccount = "bloq.bloqvia.testnet", doorOpen, door, network = "NEAR testnet", blockHeight = null, tip = defaultTip, intro = true, locked = false, firstNumber = 1, host = MERCHANT, world = "fields", guideAt = "here", curtain = false, ticker = true, onArrived, hostHello = "Hello! The shop's still open. Come and trade any time.", className },
  ref,
) {
  const level = Math.max(0, Math.min(3, Math.floor(levelIn)));
  const open = !locked && (doorOpen ?? level >= 3);
  const box = useRef<HTMLDivElement>(null);
  const refPath = useRef<SVGPathElement>(null);
  const walker = useRef<HTMLDivElement>(null);
  const guide = useRef<BloqHandle>(null);
  const merchant = useRef<BloqHandle>(null);
  const txs = useRef<(SVGRectElement | null)[]>([]);
  const stopEls = useRef<(HTMLDivElement | null)[]>([]);
  const arrivedRef = useRef(onArrived); arrivedRef.current = onArrived;
  const [w, setW] = useState(0);
  const [geo, setGeo] = useState<{ len: number; stopLen: number[]; door: Pt } | null>(null);
  const [lamps, setLamps] = useState<Lamp[]>([]);
  const [facing, setFacing] = useState<"left" | "right">("left");
  // The meeting at the shop: both Bloqs cheer together when the guide arrives (then back to idle / waving).
  // Once the shop is open the merchant faces left, towards the guide standing beside his door.
  const [guidePose, setGuidePose] = useState<"idle" | "cheer" | "sit">("idle");
  const [merchantPose, setMerchantPose] = useState<"wave" | "cheer">("wave");
  const [line, sayRaw] = useSay();
  const [hostLine, hostSayRaw] = useSay();
  const [gone, setGone] = useState(guideAt === "gone");
  const [peek, setPeek] = useState(false);
  const peekT = useRef<number | undefined>(undefined);
  // Unique per trail, so two trails on one page (Season 1 and Season 2) each light their own road.
  const maskId = `bloq-trail-lit-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const fadeId = `${maskId}-fade`;
  const at = useRef(level);            // the stop Bloq is standing at
  const walkingRef = useRef(false);
  const timers = useRef<number[]>([]);

  const say = useCallback((text: string) => { sayRaw(text); guide.current?.talk(talkMs(text)); }, [sayRaw]);
  const cheerRef = useRef<(line?: string) => void>(() => {});
  const jumpRef = useRef<ChainTrailHandle["jumpTo"]>(async () => {});
  const entryRef = useRef<ChainTrailHandle["entry"]>(() => null);
  const perchRef = useRef<ChainTrailHandle["perchAt"]>(async () => {});
  useImperativeHandle(ref, () => ({
    say, cheer: (line) => cheerRef.current(line),
    entry: () => entryRef.current(), jumpTo: (to, line) => jumpRef.current(to, line),
    greet: () => { guide.current?.jump(); say(tip(at.current, stops)); },
    perchAt: (to, line, instant, sit) => perchRef.current(to, line, instant, sit),
  }), [say, tip, stops]);
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
    return { x: p.x + (right ? 90 : -90), y: p.y + 40, face: right ? "left" : "right" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);
  const pos = useRef<Pt>({ x: 0, y: 0 });   // where the guide's feet are now (trail coordinates)
  const place = (x: number, y: number) => { pos.current = { x, y }; if (walker.current) walker.current.style.transform = `translate(${x - 44}px, ${y - 117}px)`; };

  // lamps along both sides, lit up to where the player has reached
  useLayoutEffect(() => {
    if (!geo) return;
    const prog = locked ? -1 : geo.stopLen[level] ?? geo.len, out: Lamp[] = [];
    for (let L = 36, k = 0; L < geo.len - 10; L += 58, k++) {
      const p = pointAt(L), q = pointAt(Math.min(geo.len, L + 1)), dx = q.x - p.x, dy = q.y - p.y, n = Math.hypot(dx, dy) || 1, side = k % 2 ? 1 : -1;
      out.push({ x: p.x + (-dy / n) * 27 * side, y: p.y + (dx / n) * 27 * side, on: L <= prog + 2 });
    }
    setLamps(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, level, locked]);

  // Little lime and lavender blocks that pop out between the two Bloqs.
  const burst = (x: number, y: number) => {
    const el = box.current; if (!el || reduced()) return;
    for (let i = 0; i < 12; i++) {
      const s = document.createElement("span"), a = -Math.PI / 2 + (i / 11 - 0.5) * 2.6, v = 46 + (i % 3) * 18;
      s.className = `spark${i % 3 === 1 ? " p" : ""}`;
      s.style.left = `${x}px`; s.style.top = `${y}px`;
      el.appendChild(s);
      s.animate(
        [{ transform: "translate(-50%,-50%) scale(.4) rotate(0deg)", opacity: 1 },
         { transform: `translate(calc(-50% + ${Math.cos(a) * v}px), calc(-50% + ${Math.sin(a) * v}px)) scale(1) rotate(${200 + i * 30}deg)`, opacity: 1, offset: 0.6 },
         { transform: `translate(calc(-50% + ${Math.cos(a) * v * 1.2}px), calc(-50% + ${Math.sin(a) * v * 1.2 + 26}px)) scale(.8) rotate(${320 + i * 30}deg)`, opacity: 0 }],
        { duration: 900, easing: "cubic-bezier(.2,.7,.4,1)" },
      ).onfinish = () => s.remove();
    }
  };

  // The guide has hopped down beside the shop: he and the merchant turn to each other and cheer together.
  const cheerTogether = (line?: string) => {
    if (!geo) return;
    const d = geo.door, mid = { x: d.x - 62, y: d.y - 62 };
    const later = (ms: number, f: () => void) => { timers.current.push(window.setTimeout(f, ms)); };
    setFacing("right");
    setGuidePose("cheer"); guide.current?.jump(); guide.current?.setMood("laugh", 1800);
    later(160, () => { setMerchantPose("cheer"); merchant.current?.jump(); merchant.current?.setMood("laugh", 1800); burst(mid.x, mid.y); });
    later(900, () => { guide.current?.jump(); merchant.current?.jump(); burst(mid.x, mid.y - 10); });
    later(1700, () => { setGuidePose("idle"); setMerchantPose("wave"); say(line ?? tip(3, stops)); });
  };
  cheerRef.current = cheerTogether;

  // Bloq stands at his stop; when `level` goes up he walks the road to the new one
  useLayoutEffect(() => {
    if (!geo || walkingRef.current) return;
    if (locked || level <= at.current || reduced()) {
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
    // The guide's body is about 60px wide and 110px tall above his feet. The road runs through the middle
    // of every block, so he leaves it just before a block (and joins it just after one) and steps round
    // the block on a curve that bulges away from it. Same for the shop at the end.
    // Each block's real box (cube, number, name and post line), measured, with a small margin.
    const br = box.current?.getBoundingClientRect();
    const keep = stopEls.current.map((el) => {
      const q = el?.getBoundingClientRect();
      return q && br ? { l: q.left - br.left - 6, r: q.right - br.left + 6, t: q.top - br.top - 6, b: q.bottom - br.top + 6 } : null;
    });
    // On narrow phones the names are as wide as the road's swing, so there we only keep clear of the cube itself.
    const cubes = stopEls.current.map((el) => {
      const q = el?.querySelector(".blk")?.getBoundingClientRect();
      return q && br ? { l: q.left - br.left - 4, r: q.right - br.left + 4, t: q.top - br.top - 4, b: q.bottom - br.top + 4 } : null;
    });
    let rects = keep;
    const clearOfBlock = (L: number, i: number) => {
      const p = pointAt(L), feet = p.y + 8, k = rects[i];
      return !k || p.x + 30 < k.l || p.x - 30 > k.r || feet < k.t || feet - 110 > k.b;
    };
    // One smooth path per stretch, walked at one steady pace. A Hermite curve joins his spot to the road with the
    // road's own direction, so he never starts off backwards; he only turns round when he really changes direction.
    const hermite = (a: Pt, b: Pt, ta: Pt, tb: Pt, out: Pt[]) => {
      const n = Math.max(8, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
      for (let j = 1; j <= n; j++) {
        const t = j / n, t2 = t * t, t3 = t2 * t;
        const h1 = 2 * t3 - 3 * t2 + 1, h2 = -2 * t3 + 3 * t2, h3 = t3 - 2 * t2 + t, h4 = t3 - t2;
        out.push({ x: h1 * a.x + h2 * b.x + h3 * ta.x + h4 * tb.x, y: h1 * a.y + h2 * b.y + h3 * ta.y + h4 * tb.y });
      }
    };
    const roadDir = (L: number): Pt => { const p = pointAt(Math.max(0, L - 6)), q = pointAt(Math.min(geo.len, L + 6)), n = Math.hypot(q.x - p.x, q.y - p.y) || 1; return { x: (q.x - p.x) / n, y: (q.y - p.y) / n }; };
    const unit = (a: Pt, b: Pt): Pt => { const n = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / n, y: (b.y - a.y) / n }; };
    const walkPath = async (pts: Pt[]) => {
      if (pts.length < 2) return;
      const acc = [0];
      for (let j = 1; j < pts.length; j++) acc.push(acc[j - 1]! + Math.hypot(pts[j]!.x - pts[j - 1]!.x, pts[j]!.y - pts[j - 1]!.y));
      const total = acc[acc.length - 1]!;
      const at = (d: number): Pt => {
        let j = 1; while (j < acc.length - 1 && acc[j]! < d) j++;
        const a = pts[j - 1]!, b = pts[j]!, seg = acc[j]! - acc[j - 1]! || 1, k = Math.min(1, Math.max(0, (d - acc[j - 1]!) / seg));
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      };
      // Facing: from where he'll be 28px further on, and only when he's moving sideways by more than 6px over that
      // distance, so a nearly vertical stretch of road doesn't make him flip back and forth.
      let face: "left" | "right" | null = null;
      const look = (d: number) => { const p = at(d), q = at(Math.min(total, d + 28)), dx = q.x - p.x; return Math.abs(dx) > 6 ? (dx > 0 ? "right" : "left") : null; };
      face = look(0) ?? (pts[pts.length - 1]!.x >= pts[0]!.x ? "right" : "left"); setFacing(face);
      await anim(Math.max(600, total * 7.5), (k) => {
        const d = total * k, f = look(d);
        if (f && f !== face) { face = f; setFacing(f); }
        const p = at(d); place(p.x, p.y);
      });
    };
    const blockAt = (i: number): Pt => { const k = keep[i]; return k ? { x: (k.l + k.r) / 2, y: (k.t + k.b) / 2 } : { x: (STOP_X[i] ?? 0.5) * w, y: STOP_Y[i] ?? 0 }; };
    const clearOfShop = (L: number) => {
      const p = pointAt(L), d = geo.door, feet = p.y + 8;
      return p.x + 30 < d.x - 74 || p.x - 30 > d.x + 74 || feet < d.y - 136 || feet - 110 > d.y + 14;
    };
    (async () => {
      walker.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      await new Promise((r) => timers.current.push(window.setTimeout(r, 500)));
      guide.current?.walking(true);
      for (let i = from + 1; i <= to && !cancelled; i++) {
        const a = rest(i - 1);
        const end = geo.stopLen[i] ?? 0;
        // Is the road at L clear of every block (and of the shop)? On narrow screens it curls close to a block before reaching it.
        const clear = (L: number) => keep.every((_, k) => clearOfBlock(L, k)) && (i < 3 || clearOfShop(L));
        const stretch = () => {
          let s0 = geo.stopLen[i - 1] ?? 0;
          while (s0 < end && !clear(s0)) s0 += 2;                            // join the road where it's clear of the block he's at
          let s1 = s0;
          while (s1 + 2 < end && clear(s1 + 2)) s1 += 2;                     // and leave it at the first point it comes near a block
          return [s0, s1] as const;
        };
        rects = keep;
        let [L0, L1] = stretch();
        if (L0 >= end || L1 - L0 < 60) { rects = cubes; [L0, L1] = stretch(); }
        // Narrow phones: the blocks and their names fill the width, so there's no clear road between two of them.
        // Then he walks straight round from one block to the next (he never hops: the only jump is into Season 2).
        const r = rest(i), path: Pt[] = [a];
        if (L0 >= end || L1 - L0 < 60) {
          // No clear road between the two blocks: one smooth curve from his spot to the next.
          hermite(a, r, { x: 0, y: (r.y - a.y) * 0.9 }, { x: (r.x - a.x) * 0.6, y: (r.y - a.y) * 0.6 }, path);
        } else {
          const s0 = pointAt(L0), s1 = pointAt(L1), j0 = { x: s0.x, y: s0.y + 8 }, j1 = { x: s1.x, y: s1.y + 8 };
          const d0 = Math.hypot(j0.x - a.x, j0.y - a.y), d1 = Math.hypot(r.x - j1.x, r.y - j1.y), t0 = roadDir(L0), t1 = roadDir(L1);
          // off his spot and onto the road (arriving in the road's direction) …
          hermite(a, j0, { x: unit(a, j0).x * d0 * 0.6, y: unit(a, j0).y * d0 * 0.6 }, { x: t0.x * d0 * 0.9, y: t0.y * d0 * 0.9 }, path);
          // … along the road …
          for (let L = L0 + 3; L < L1; L += 3) { const p = pointAt(L); path.push({ x: p.x, y: p.y + 8 }); }
          // … and off it, round to his spot beside the next block (or the shop's door).
          hermite(j1, r, { x: t1.x * d1 * 0.5, y: t1.y * d1 * 0.5 }, { x: 0, y: d1 * 0.7 }, path);
        }
        await walkPath(path);
        at.current = i;
      }
      guide.current?.walking(false);
      const r = rest(to); setFacing(r.face); walkingRef.current = false;
      if (cancelled) return;
      if (to >= 3) { cheerTogether(); timers.current.push(window.setTimeout(() => arrivedRef.current?.(to), 2300)); return; }
      guide.current?.jump();
      say(tip(to, stops));
      arrivedRef.current?.(to);
    })();
    return () => { cancelled = true; walkingRef.current = false; guide.current?.walking(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, level, locked]);

  // say hello once, the first time the trail is on screen
  // Between seasons: the guide is on this road or not; he moves with one jump (jumpTo) from one road to the next.
  useEffect(() => { setGone(guideAt === "gone"); }, [guideAt]);
  entryRef.current = () => {
    const el = box.current; if (!el || !geo) return null;
    const r = el.getBoundingClientRect(), p = rest(0);
    return { x: r.left + p.x, y: r.top + p.y };
  };
  jumpRef.current = async (to, line = "Season 2, here I come!") => {
    const el = box.current; if (!el || !geo) return;
    const r = el.getBoundingClientRect(), a = perched.current ? pos.current : rest(at.current), b = { x: to.x - r.left, y: to.y - r.top };
    const wasPerched = perched.current; perched.current = false; setSeated(false);
    const wait = (ms: number) => new Promise<void>((res) => { timers.current.push(window.setTimeout(res, ms)); });
    setGone(false); place(a.x, a.y);
    if (!reduced()) {
      // Take-off and landing both on screen: centre the middle of the jump while he says his line.
      window.scrollBy({ top: (r.top + a.y + to.y) / 2 - window.innerHeight * 0.5, behavior: "smooth" });
      setFacing(b.x >= a.x ? "right" : "left"); say(line); guide.current?.talk(talkMs(line));
      await wait(1400);
      // He stays seated while he talks, and stands up as he takes off.
      if (wasPerched) setGuidePose("idle");
      guide.current?.jump(); sayRaw("");
      // One high arc, out to the left of the door text, then down through the gate (which sits above him,
      // so he passes behind it like a portal) onto the next road.
      // From the shop: up and out to the left, down the left edge (clear of the door text on narrow phones too), then in to the block.
      // From the card: one high arc in front of everything, over the card and down onto the block.
      const left = Math.min(a.x, b.x);
      const [c1, c2] = a.y > b.y - 40 || a.x - b.x > 120
        ? [{ x: a.x - 30, y: a.y - 170 }, { x: b.x + 20, y: b.y - 190 }]
        : [{ x: left - 70, y: a.y - 230 }, { x: left - 90, y: b.y - 150 }];
      await new Promise<void>((res) => {
        const t0 = performance.now(), ms = 1400;
        const tick = (now: number) => {
          const k = Math.min(1, (now - t0) / ms), u = 1 - k, q = (p0: number, p1: number, p2: number, p3: number) => u * u * u * p0 + 3 * u * u * k * p1 + 3 * u * k * k * p2 + k * k * k * p3;
          place(Math.max(30, q(a.x, c1.x, c2.x, b.x)), q(a.y, c1.y, c2.y, b.y));
          k < 1 ? requestAnimationFrame(tick) : res();
        };
        requestAnimationFrame(tick);
      });
    }
    setGone(true);
  };

  // Off to the next season's card: he walks down the left of the shop (clear of its text), onto the card's top edge,
  // along the edge to his spot, and sits down on the edge with his legs over the front, like on the sign-in card.
  const perched = useRef(false);
  const [seated, setSeated] = useState(false);
  const [bounce, setBounce] = useState(0);
  // Seated and waiting: his eyes follow the pointer, like on the sign-in card.
  useEffect(() => {
    if (!seated) return;
    const onMove = (e: PointerEvent) => {
      const el = walker.current; if (!el) return;
      const q = el.getBoundingClientRect();
      const dx = (e.clientX - (q.left + q.width / 2)) / (window.innerWidth / 2), dy = (e.clientY - (q.top + q.height * 0.3)) / (window.innerHeight / 2);
      guide.current?.look(Math.max(-1, Math.min(1, dx)), Math.max(-1, Math.min(1, dy)));
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [seated]);
  // sit = false: he stands on the edge (nothing of him over the card); true: he sits with his legs over the front.
  perchRef.current = async (to, line = "Ready for Season 2? Press Start and I'll jump in!", instant = false, sit = false) => {
    const el = box.current; if (!el || !geo) return;
    const r = el.getBoundingClientRect(), a = perched.current ? pos.current : rest(at.current);
    const edge = to.y - r.top, seat = { x: to.x - r.left, y: edge };
    // Exactly like the sign-in card: his feet line (96% of his height) on the edge to walk, then he lowers by 21% of
    // his height to sit, so he sits on the edge with only his shoes over the front. The guide is 88px wide, 117px tall.
    const H = 117.33, FEET = H * 0.04, SIT = FEET + H * 0.21;
    setGone(false);
    if (!instant && !reduced()) {
      // Keep the card in view while he walks to it.
      if (to.y > window.innerHeight * 0.8 || to.y < 80) window.scrollBy({ top: to.y - window.innerHeight * 0.62, behavior: "smooth" });
      const lane = Math.max(34, Math.min(a.x - 60, geo.door.x - 150));    // left of the door text
      const onEdge = edge + FEET;
      const pts: Pt[] = [a, { x: lane, y: a.y + 40 }, { x: lane, y: onEdge }, { x: seat.x, y: onEdge }];
      setGuidePose("idle"); guide.current?.walking(true);
      for (let s = 1; s < pts.length; s++) {
        const p0 = pts[s - 1]!, p1 = pts[s]!, dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        if (Math.abs(p1.x - p0.x) > 4) setFacing(p1.x > p0.x ? "right" : "left");
        await new Promise<void>((res) => {
          const t0 = performance.now(), ms = Math.max(250, dist * 7.5);
          const tick = (now: number) => { const k = Math.min(1, (now - t0) / ms); place(p0.x + (p1.x - p0.x) * k, p0.y + (p1.y - p0.y) * k); k < 1 ? requestAnimationFrame(tick) : res(); };
          requestAnimationFrame(tick);
        });
      }
      guide.current?.walking(false);
      // Sitting down: he faces right and lowers onto the edge in 420ms, as on the sign-in card, then laughs.
      setFacing("right");
      if (sit) setGuidePose("sit");
      if (sit) await new Promise<void>((res) => {
        const t0 = performance.now(), ms = 420;
        const ease = (k: number) => { const t = 1 - k; return 1 - t * t * (1 + 0.6 * k); };   // close to cubic-bezier(.3,.7,.4,1)
        const tick = (now: number) => { const k = Math.min(1, (now - t0) / ms); place(seat.x, onEdge + (edge + SIT - onEdge) * ease(k)); k < 1 ? requestAnimationFrame(tick) : res(); };
        requestAnimationFrame(tick);
      });
      guide.current?.setMood("laugh", 900);
      await new Promise<void>((res) => { timers.current.push(window.setTimeout(res, 320)); });
    }
    place(seat.x, sit ? edge + SIT : edge + FEET); perched.current = true; setSeated(sit);
    setFacing("right"); setGuidePose(sit ? "sit" : "idle");
    say(line);
  };

  // The merchant behind his curtain: he peeks out to say hello, then slips back in.
  const peekOut = (ms: number) => {
    if (!curtain || !open) return;
    window.clearTimeout(peekT.current);
    if (!peek) { hostSayRaw(hostHello); merchant.current?.talk(talkMs(hostHello)); timers.current.push(window.setTimeout(() => { merchant.current?.jump(); merchant.current?.setMood("laugh", 1200); }, 380)); }
    setPeek(true);
    peekT.current = window.setTimeout(() => setPeek(false), ms);
  };
  const peekIn = (ms: number) => { window.clearTimeout(peekT.current); peekT.current = window.setTimeout(() => setPeek(false), ms); };
  useEffect(() => () => window.clearTimeout(peekT.current), []);

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
  const prog = geo && !locked ? geo.stopLen[level] ?? geo.len : 0;
  return (
    <div className={["bloq-trail-wrap", world === "city" ? "w-city" : "", className ?? ""].join(" ")}>
      {ticker ? <BlockTicker network={network} blockHeight={blockHeight} /> : null}
      <div ref={box} className="bloq-trail" style={{ height: HEIGHT }}>
        <div className="world" aria-hidden="true">
          {world === "city" ? <Skyline /> : w > 0 ? <Orchard w={w} /> : null}
          {TOWERS.map(([x, y, t], i) => (
            <span key={i} className="tower" style={{ left: `calc(${x * 100}% + ${(0.5 - x) * 32}px)`, top: y + 14 }}>{world === "city" ? <Node /> : <Tower />}{t ? <small>{world === "city" ? (i ? "indexer" : "rpc node") : t}</small> : null}</span>
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className={`chunk${i % 3 === 0 ? " l" : ""}${world === "city" ? " coin" : ""}`} style={{ left: `${6 + ((i * 37) % 88)}%`, "--t": `${18 + (i % 4) * 5}s`, "--d": `-${i * 2.3}s` } as CSSProperties} />
          ))}
        </div>

        <svg className="road" viewBox={`0 0 ${w || 360} ${HEIGHT}`} aria-hidden="true">
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse"><path className="p-mask" d={d} style={geo ? { strokeDasharray: geo.len, strokeDashoffset: geo.len - prog } : undefined} /></mask>
            {/* the road (and its lamps and transactions) fades out round each block; where two fades meet they add up */}
            <radialGradient id={`${fadeId}-g`}><stop offset={FADE.core} stopColor="#000" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
            <mask id={fadeId} maskUnits="userSpaceOnUse" x={-60} y={-60} width={(w || 360) + 120} height={HEIGHT + 120}>
              <rect x={-60} y={-60} width={(w || 360) + 120} height={HEIGHT + 120} fill="#fff" />
              {[0, 1, 2].map((i) => <ellipse key={i} cx={(STOP_X[i] ?? 0) * w} cy={STOP_Y[i] ?? 0} rx={FADE.rx} ry={FADE.ry} fill={`url(#${fadeId}-g)`} />)}
            </mask>
          </defs>
          <g mask={`url(#${fadeId})`}>
            <path className="p-rim" d={d} /><path className="p-edge" d={d} /><path className="p-base" d={d} /><path className="p-tiles" d={d} />
            <path className="p-lit" d={d} mask={`url(#${maskId})`} /><path className="p-chain" d={d} />
            <g>{lamps.map((l, i) => (
              <g key={i} className={`lamp${l.on ? " on" : ""}`}><line x1={l.x} y1={l.y} x2={l.x} y2={l.y - 9} /><circle className="glow" cx={l.x} cy={l.y - 11} r="7" /><circle className="dot" cx={l.x} cy={l.y - 11} r="3" /></g>
            ))}</g>
            <g>{[0, 1, 2].map((i) => <rect key={i} ref={(n) => { txs.current[i] = n; }} className={`tx${i === 1 ? " p" : ""}`} width="8" height="8" rx="1.5" style={{ opacity: 0 }} />)}</g>
          </g>
          {/* where the road has faded, three stepping stones carry on into each block, smaller and fainter towards it; lime once reached */}
          {geo ? <g>{[0, 1, 2].flatMap((i) => [-1, 1].flatMap((side) => {
            if (i === 0 && side < 0) return []; // the road starts at the first block
            const L0 = geo.stopLen[i] ?? 0;
            return STONES.map(([k, r], j) => {
              const L = L0 + side * k, p = pointAt(L), q = pointAt(L + side), a = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
              return <rect key={`${i}${side}${j}`} className={`stone${!locked && L <= prog + 1 ? " on" : ""}`} x={-r} y={-r * 0.62} width={r * 2} height={r * 1.24} rx="2.5" transform={`translate(${p.x} ${p.y}) rotate(${a})`} style={{ opacity: 1 - j * 0.18 }} />;
            });
          }))}</g> : null}
          <path ref={refPath} d={d} fill="none" stroke="none" />
        </svg>

        {w > 0 && stops.map((s, i) => {
          const state: BlockState = locked ? "locked" : i < level ? "done" : i === level ? "avail" : "locked";
          return (
            <div key={s.id} ref={(n) => { stopEls.current[i] = n; }} className={`stop ${state}`} style={{ left: (STOP_X[i] ?? 0.5) * w, top: STOP_Y[i] }}>
              <button type="button" className="blk" disabled={state !== "avail"} onClick={() => onPlay(i)} aria-label={`${s.title}: ${state === "done" ? "done" : state === "avail" ? "play" : "locked"}`}>
                <QuestBlock kind={s.kind} state={state} />
                <span className="mark">{state === "done" ? <Check /> : state === "avail" ? String(firstNumber + i).padStart(2, "0") : <Lock />}</span>
                {state === "done" && s.reward ? <span className="badge">{s.reward}</span> : null}
              </button>
              <span className="lbl">{s.title}</span>
              <span className="post">{s.post}</span>
            </div>
          );
        })}

        {geo ? (
          <div className={`door${open ? " open" : ""}${curtain && open ? " curtained" : ""}${peek ? " peek" : ""}`} style={{ left: geo.door.x, top: geo.door.y - 118 }}>
            <div
              className="arch-wrap"
              {...(curtain && open ? {
                role: "button", tabIndex: 0, "aria-label": `${host.label}: say hello`,
                onPointerEnter: () => peekOut(4000), onPointerLeave: () => peekIn(900), onFocus: () => peekOut(4000), onBlur: () => peekIn(300),
                onClick: () => peekOut(3200), onKeyDown: (e: ReactKeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); peekOut(3200); } },
              } : {})}
            >
              <span className="plate">{doorAccount}</span>
              {curtain && open ? <SpeechBubble text={hostLine} tone="light" className="host-say" /> : null}
              <div className="arch">
                <div className="inside" />
                <div className="merchant"><Bloq ref={merchant} hat={host.hat} prop={host.prop} pose={merchantPose} facing={level >= 3 ? "left" : "right"} label={host.label} /></div>
                <div className="curtain" aria-hidden="true"><i className="l" /><i className="r" /></div>
                <div className="awn" />
                <div className="leaf"><Lock /></div>
              </div>
            </div>
            {door}
          </div>
        ) : null}

        <div ref={walker} className="walker" hidden={locked || gone} onPointerEnter={() => { if (seated) guide.current?.setMood("laugh", 700); }}
          onClick={() => {
            if (seated) { guide.current?.setMood("laugh", 1400); if (!reduced()) setBounce((b) => b + 1); return; }
            guide.current?.jump(); say(tip(at.current, stops));
          }}>
          <div key={bounce} className={bounce ? "bq-sit-bounce" : undefined}>
            <Bloq ref={guide} hat="cap" pose={guidePose} facing={facing} label="Bloq, your guide on the map" />
          </div>
          <SpeechBubble text={line} tone="light" />
        </div>
      </div>
    </div>
  );
});
