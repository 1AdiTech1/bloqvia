/* Phase 3 (Nov 9, approved in the turnaround mock v4.13): today's 15 hats on the 3D slab head, every part computed point by point.

   Facing you each hat is exactly today's drawing. Turned, every point of every part is placed on the part's surface:
   - a round part (crown, helmet, band, brim, ear pad) is a stack of oval slices, one per line of the drawing, each as
     wide as the drawing there and as deep as its share of the part's depth; its outline is the turned slices' edges;
   - what is painted or fixed on a part (stripes, seams, logos, badges, goggles, a buckle, side screws) is placed point
     by point on the front of those slices, so it can never leave the part: near the edge it folds round with it, and it
     hides when its side of the part turns away;
   - brims and visors are plates fixed along the crown's rim: each point of today's drawing gets a depth between the
     rim (its top edge) and the plate's outer edge (its bottom edge), so the plate stays on the crown from every side;
   - a helmet's face opening stays round the face (it turns with his face) and the helmet closes behind;
   - a strap round a hat follows the hat's round section; the agent's mic sits on his face; the mortarboard is a board. */

import { HAT_ART, HAT_SCALE } from "./hatArt";

type El = { tag: string; a: Record<string, string> };
type Pt = [number, number];
type Sub = { p: Pt[]; closed: boolean };
type Round = "dome" | "band" | "disk";
type Spec =
  | { k: "round"; p: Round; zh: number; closed?: undefined | string; ell?: undefined | boolean; pe?: undefined | number; rim?: undefined | boolean } // rim: its bottom is drawn curving up (a cap's rim as today's front view draws it); turned, it is the level rim // round part, centred front to back; closed: a helmet's outline with the face opening shut; ell: seen from the side its outline is a round dome (zh deep at its base)
  | { k: "slab"; z: [number, number]; w?: undefined | number }          // a small free part (a button, a nub, the tassel end); w: layered with that part
  | { k: "on"; parent: number }                             // fixed on the parent's front (logo, badge, goggles, buckle)
  | { k: "decal"; parent: number; ring?: undefined | boolean; seam?: undefined | boolean } // painted on the parent (stripes, seams, highlights); ring: all the way round; seam: a level line round a band (the beanie's cuff fold)
  | { k: "side"; parent: number }                           // fixed on a helmet's side (screws, side lines): stays when the helmet closes
  | { k: "face" }                                           // on his face (the agent's mic)
  | { k: "plate"; parent: number; side: 1 | -1; L: number; th: number; reach?: undefined | number } // a brim or visor on the parent's rim, reaching L out; reach: a bill that points back as it goes out sideways
  | { k: "ribbon"; hz: number; fill: number }               // a headband: a strip (the drawing's thick line) hz deep, its colour from part fill
  | { k: "peak"; parent: number; p: number[] }              // a cap's peak as a real curved peak on the crown's rim (see PEAK below)
  | { k: "stroke"; z: [number, number]; ring?: undefined | number }     // a thick line swept through depth; ring: follows the parent's round section
  | { k: "board" }
  | { k: "onboard"; hang?: undefined | [number, number]; rigid?: undefined | boolean } // on the mortarboard (its line, button, cord); hang: the point a cord hangs from
  | { k: "skip" };

const HATS = HAT_ART as Record<string, El[]>;
const SCALE = HAT_SCALE;
const RAD = Math.PI / 180;
const INK = "#1b1622";
const ss = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const f = (n: number) => n.toFixed(2);
const g = (n: number) => n.toFixed(1);

const R = (p: Round, zh: number, closed?: undefined | string): Spec => ({ k: "round", p, zh, closed });
const ON = (parent: number): Spec => ({ k: "on", parent });
const D = (parent: number): Spec => ({ k: "decal", parent });
const SD = (parent: number): Spec => ({ k: "side", parent });
const RD = (parent: number): Spec => ({ k: "decal", parent, ring: true });
const SEAM = (parent: number): Spec => ({ k: "decal", parent, ring: true, seam: true });
const SL = (z0: number, z1: number, w?: undefined | number): Spec => ({ k: "slab", z: [z0, z1], w });
const T = (z0: number, z1: number, ring?: undefined | number): Spec => ({ k: "stroke", z: [z0, z1], ring });
const OB = (hang?: undefined | [number, number], rigid?: undefined | boolean): Spec => ({ k: "onboard", hang, rigid });
const PL = (parent: number, side: 1 | -1, L: number, th = 6, reach?: undefined | number): Spec => ({ k: "plate", parent, side, L, th, reach });
const DOME = (zh: number, pe = 2): Spec => ({ k: "round", p: "dome", zh, ell: true, pe, rim: true });
const RIM = (zh: number): Spec => ({ k: "round", p: "dome", zh, rim: true }); // pe > 2: a fuller, flatter-topped dome from the side

const MOTO_SHUT = "M60 162 C50 82 94 20 152 20 C210 20 256 82 246 162 L246 174 C246 184 232 186 226 178 C190 190 116 190 80 178 C74 186 60 184 60 174 Z";
const ASTRO_SHUT = "M54 168 C42 80 92 20 152 20 C212 20 262 80 250 168 C248 184 236 190 222 186 C186 194 118 194 82 186 C68 190 56 184 54 168 Z";

/* Every part of every hat (index = its place in today's drawing). zh: half its depth, front to back (the head is ±25). */
export const SPECS: Record<string, Record<number, Spec>> = {
  cap: { 0: { k: "peak", parent: 1, p: [0, 1.004, 51.7, 0.5, 37.33, 2.001, 23.82, 98.67, 11.48] }, 1: DOME(56, 3), 2: D(1), 3: D(1), 4: D(1), 5: SL(-8, 8) },  // worn to the side: the peak over his right ear
  cap2: { 0: RIM(52), 1: D(0), 2: ON(0), 3: ON(0), 4: ON(0), 5: PL(0, 1, 62), 6: D(5), 7: SL(-8, 8) },
  tophat: { 0: R("band", 44), 1: R("disk", 44), 2: R("band", 45), 3: ON(2), 4: D(0), 5: R("disk", 66) },
  agent: { 0: T(-3, 3), 1: SL(-6, 6), 2: { k: "ribbon", hz: 7, fill: 3 }, 3: { k: "skip" }, 4: { k: "skip" }, 5: R("disk", 23), 6: D(5), 7: R("disk", 23), 8: D(7), 9: { k: "face" }, 10: { k: "face" } },
  bucket: { 0: R("dome", 48), 1: D(0), 2: R("disk", 72), 3: D(2), 4: ON(0) },
  beanie: { 0: R("dome", 50), 1: D(0), 2: R("band", 51), 3: SEAM(2), 4: SL(-11, 11) },
  captain: { 0: R("band", 42), 1: PL(0, 1, 40, 5), 2: R("dome", 58), 3: D(2), 4: D(2), 5: ON(2) },
  hardhat: { 0: R("dome", 52), 1: D(0), 2: D(0), 3: R("disk", 68) },
  beret: { 0: R("disk", 56), 1: D(0), 2: D(0), 3: T(-3, 3), 4: SL(-6, 6, 3) },
  detective: { 0: R("dome", 52), 1: D(0), 2: D(0), 3: PL(0, 1, 16), 4: SL(-7, 7), 5: SL(-7, 7) },
  moto: { 0: R("dome", 82, MOTO_SHUT), 1: D(0), 2: D(0), 3: D(0), 4: D(0), 5: SD(0), 6: SD(0) },
  astro: { 0: R("disk", 42), 1: D(0), 2: R("dome", 80, ASTRO_SHUT), 3: D(2), 4: SD(2), 5: SD(2), 6: SD(2), 7: D(2), 8: ON(2),
    9: ON(2), 10: ON(2), 11: ON(2), 12: ON(2), 13: ON(2), 14: ON(2), 15: ON(2), 16: ON(2), 17: R("disk", 28), 18: R("disk", 28), 19: D(17), 20: D(18), 21: D(17), 22: D(18) },
  aviator: { 0: R("dome", 56), 1: R("disk", 28), 2: R("disk", 28), 3: D(0), 4: D(0), 5: RD(0), 6: ON(0), 7: ON(0), 8: ON(0), 9: D(1), 10: D(2) },
  surf: { 0: R("dome", 48), 1: R("band", 49), 2: D(0), 3: R("disk", 72) },
  grad: { 0: R("band", 34), 1: { k: "board" }, 2: OB(), 3: OB([86, 78]), 4: OB([86, 78]), 5: OB([86, 78], true), 6: OB(undefined, true) },
};
export const HAT_NAMES = Object.keys(SPECS);

/* The guide's cap is worn to the side, to be cool. Its peak is a real cap peak: fixed along the crown's rim over his
   right ear, pointing out to his right and a little forward, tilted down, its edges curving down. In drawing units:
   gam: how far it turns from straight out to the side toward the front (radians); dphi: half the stretch of rim it is
   fixed on (radians round the rim); L: how far it reaches out in the middle; q: how round its outer edge is; droop and
   pw: how far and how it tilts down toward its edge; c: how far its corners curve down; yr, yb: the rim's height in
   the middle of the peak and how much lower at its corners. The crown's half depth at its rim comes from the crown.
   Fitted so that, facing you, it covers today's drawn peak. */
/** Hats that cover his ears (ear cups, flaps, helmets): with these he shows no ear lights. */
export const COVERS_EARS = new Set(["agent", "moto", "astro", "aviator"]);

/* Parts that settle as he turns: facing you the agent's headband arches clear of his head (today's drawing); side-on it
   rests on top of it, the antenna and light going down with it. y0: the band's top, y1: where it meets the ear cups,
   d: how far its top comes down side-on (drawing units). */
const SETTLE: Record<string, { parts: number[]; y0: number; y1: number; d: number }> = { agent: { parts: [0, 1, 2, 3], y0: 22, y1: 112, d: 27 } };

/* front fills (today's colours, as the model's gradients) and the shade of each colour for the sides */
const FRONT: Record<string, string> = { "#8b45d9": "url(#bq-pg)", "#6630b3": "url(#bq-pdg)", "#d4f033": "url(#bq-lg)", "#D4F033": "url(#bq-lg)", "url(#bq-pdg)": "url(#bq-pdg)", "url(#bq-wg)": "url(#bq-wg)" };
const SHADE: Record<string, string> = { "#8b45d9": "#6a2fc0", "#6630b3": "#4a2389", "#d4f033": "#a3bd1e", "#D4F033": "#a3bd1e", "#a6c21a": "#7d9312", "#b47ff0": "#8b54d6", "#1b1622": "#1b1622", "url(#bq-pdg)": "#4a2389", "url(#bq-wg)": "#cdc2e6", "#ffffff": "#cdc2e6" };

/* ---------- today's drawing as points ---------- */

/** An element of the drawing as polylines (curves and arcs cut into short straight pieces), in the drawing's units. */
function flatten(e: El): Sub[] {
  const a = e.a, n = (k: string) => parseFloat(a[k] ?? "0");
  let subs: Sub[] = [];
  const ring = (cx: number, cy: number, rx: number, ry: number, m = 48): Sub => ({ p: Array.from({ length: m }, (_, i) => [cx + rx * Math.cos((i / m) * 2 * Math.PI), cy + ry * Math.sin((i / m) * 2 * Math.PI)] as Pt), closed: true });
  if (e.tag === "circle") subs = [ring(n("cx"), n("cy"), n("r"), n("r"))];
  else if (e.tag === "ellipse") subs = [ring(n("cx"), n("cy"), n("rx"), n("ry"))];
  else if (e.tag === "rect") {
    const x = n("x"), y = n("y"), w = n("width"), h = n("height"), r = Math.min(n("rx"), w / 2, h / 2), p: Pt[] = [];
    const corner = (cx: number, cy: number, a0: number) => { for (let k = 0; k <= 6; k++) { const t = (a0 + (k / 6) * 90) * RAD; p.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } };
    corner(x + w - r, y + r, -90); corner(x + w - r, y + h - r, 0); corner(x + r, y + h - r, 90); corner(x + r, y + r, 180);
    subs = [{ p, closed: true }];
  } else {
    const toks = (a["d"] ?? "").match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
    let i = 0, cmd = "M", x = 0, y = 0, sx = 0, sy = 0, cur: Pt[] = [], lc: Pt | null = null;
    const num = () => parseFloat(toks[i++]!);
    const flush = (closed: boolean) => { if (cur.length > 1) subs.push({ p: cur, closed }); cur = []; };
    const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt) => { for (let k = 1; k <= 16; k++) { const t = k / 16, u = 1 - t; cur.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } };
    while (i < toks.length) {
      if (/[a-zA-Z]/.test(toks[i]!)) cmd = toks[i++]!;
      const rel = cmd === cmd.toLowerCase() && cmd !== "z", C = cmd.toUpperCase();
      const P = (px: number, py: number): Pt => (rel ? [x + px, y + py] : [px, py]);
      if (C === "Z") { flush(true); x = sx; y = sy; lc = null; continue; }
      if (C === "M") { flush(false); const q = P(num(), num()); x = sx = q[0]; y = sy = q[1]; cur = [q]; cmd = rel ? "l" : "L"; lc = null; continue; }
      if (cur.length === 0) cur = [[x, y]];
      if (C === "L") { const q = P(num(), num()); cur.push(q); [x, y] = q; lc = null; }
      else if (C === "H") { const v = num(); x = rel ? x + v : v; cur.push([x, y]); lc = null; }
      else if (C === "V") { const v = num(); y = rel ? y + v : v; cur.push([x, y]); lc = null; }
      else if (C === "C" || C === "S") {
        const p1: Pt = C === "C" ? P(num(), num()) : lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y];
        const p2 = P(num(), num()), p3 = P(num(), num());
        cubic([x, y], p1, p2, p3); lc = p2; [x, y] = p3;
      } else if (C === "Q") {
        const q1 = P(num(), num()), q2 = P(num(), num());
        cubic([x, y], [x + (2 / 3) * (q1[0] - x), y + (2 / 3) * (q1[1] - y)], [q2[0] + (2 / 3) * (q1[0] - q2[0]), q2[1] + (2 / 3) * (q1[1] - q2[1])], q2); lc = null; [x, y] = q2;
      } else if (C === "A") {
        let rx = Math.abs(num()), ry = Math.abs(num()); const phi = num() * RAD, fa = num(), fs = num(); const q = P(num(), num());
        // endpoint → centre form (SVG implementation notes, F.6.5)
        const cp = Math.cos(phi), sp = Math.sin(phi), dx = (x - q[0]) / 2, dy = (y - q[1]) / 2;
        const x1 = cp * dx + sp * dy, y1 = -sp * dx + cp * dy;
        const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry); if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
        const num2 = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1, den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
        const co = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num2 / den));
        const cxp = (co * rx * y1) / ry, cyp = (-co * ry * x1) / rx;
        const cx = cp * cxp - sp * cyp + (x + q[0]) / 2, cy = sp * cxp + cp * cyp + (y + q[1]) / 2;
        const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
        const t1 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
        let dt = ang((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
        if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
        const m = Math.max(4, Math.ceil(Math.abs(dt) / (8 * RAD)));
        for (let k = 1; k <= m; k++) { const t = t1 + (dt * k) / m; cur.push([cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp]); }
        [x, y] = q; lc = null;
      } else { i++; }
    }
    flush(false);
  }
  // the element's own turn (the detective's two tufts)
  const rot = /rotate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/.exec(a["transform"] ?? "");
  if (rot) {
    const t = parseFloat(rot[1]!) * RAD, cx = parseFloat(rot[2]!), cy = parseFloat(rot[3]!), c = Math.cos(t), s = Math.sin(t);
    subs = subs.map((q) => ({ closed: q.closed, p: q.p.map(([px, py]) => [cx + (px - cx) * c - (py - cy) * s, cy + (px - cx) * s + (py - cy) * c] as Pt) }));
  }
  return subs;
}

/** A part's slices: for each line of the drawing, the middle and half-width of the part there. */
type Slices = { y0: number; y1: number; at: (y: number) => { c: number; w: number } };
function slicesOf(subs: Sub[]): Slices {
  const edges: [Pt, Pt][] = [];
  for (const q of subs) for (let k = 0; k < q.p.length; k++) { const b = q.p[(k + 1) % q.p.length]!; if (k + 1 < q.p.length || q.closed || true) edges.push([q.p[k]!, b]); }
  const ys = subs.flatMap((q) => q.p.map((p) => p[1]));
  const y0 = Math.min(...ys), y1 = Math.max(...ys), N = Math.max(2, Math.ceil(y1 - y0) * 2);
  const C: number[] = [], Wd: number[] = [];
  let lastC = 0, lastW = 0.5;
  for (let k = 0; k <= N; k++) {
    const y = y0 + ((y1 - y0) * Math.min(Math.max(k, 0.02), N - 0.02)) / N;
    let lo = Infinity, hi = -Infinity;
    for (const [p, q] of edges) {
      if ((p[1] - y) * (q[1] - y) > 0 || p[1] === q[1]) continue;
      const x = p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1]);
      lo = Math.min(lo, x); hi = Math.max(hi, x);
    }
    if (hi > lo) { lastC = (lo + hi) / 2; lastW = (hi - lo) / 2; }
    C.push(lastC); Wd.push(lastW);
  }
  // a nearly flat end (a band's bottom running a pixel downhill) would give slices that shrink to nothing within a
  // pixel; no slice may be narrower than its neighbours allow at 4 units of width per unit of height
  const G = 4, step = (y1 - y0) / N, C2 = [...C], W2 = [...Wd];
  for (let k = 0; k <= N; k++) for (let m = 0; m <= N; m++) {
    const v = Wd[m]! - G * Math.abs(k - m) * step;
    if (v > W2[k]!) { W2[k] = v; C2[k] = C[m]!; }
  }
  C.splice(0, C.length, ...C2); Wd.splice(0, Wd.length, ...W2);
  return {
    y0, y1,
    at: (y: number) => {
      const t = Math.max(0, Math.min(N, ((y - y0) / (y1 - y0 || 1)) * N)), k = Math.min(N - 1, Math.floor(t)), r = t - k;
      return { c: C[k]! + (C[k + 1]! - C[k]!) * r, w: Math.max(0.5, Wd[k]! + (Wd[k + 1]! - Wd[k]!) * r) };
    },
  };
}

const GEO = new Map<string, Sub[]>();
const TAB = new Map<string, Slices>();
const geo = (key: string, e: El) => { let v = GEO.get(key); if (!v) { v = flatten(e); GEO.set(key, v); } return v; };
/** slices are taken through the part's convex outline, so a curved band (its ends lower than its middle) stays whole */
const tab = (key: string, subs: () => Sub[]) => { let v = TAB.get(key); if (!v) { v = slicesOf([{ p: hull(subs().flatMap((q) => q.p)) as Pt[], closed: true }]); TAB.set(key, v); } return v; };
const dOf = (subs: { p: Pt[]; closed: boolean }[]) => subs.map((q) => "M" + q.p.map((p) => `${g(p[0])} ${g(p[1])}`).join(" L") + (q.closed ? " Z" : "")).join(" ");

/** The element as a path with these points, keeping its paint (colours, widths, dashes, opacity, animation class). */
const GEOM = new Set(["d", "cx", "cy", "r", "rx", "ry", "x", "y", "width", "height", "transform"]);
function asPath(e: El, d: string, change: Record<string, string | null> = {}, extra = "") {
  const a: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.a)) if (!GEOM.has(k)) a[k] = v;
  for (const [k, v] of Object.entries(change)) { if (v === null) delete a[k]; else a[k] = v; }
  return `<path d="${d}" ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(" ")}${extra}/>`;
}
// every part is drawn as points already on the screen, so line widths are plain (they scale with the drawing like today's)
const VF = "";
/** Clip ids must be unique on the whole page (the same hat is drawn many times on it). */
let CLIP_SEQ = 0;

function hull(points: number[][]) {
  const p = [...points].sort((A, B) => A[0]! - B[0]! || A[1]! - B[1]!);
  const cross = (O: number[], A: number[], B: number[]) => (A[0]! - O[0]!) * (B[1]! - O[1]!) - (A[1]! - O[1]!) * (B[0]! - O[0]!);
  const lo: number[][] = [], up: number[][] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (up.length >= 2 && cross(up[up.length - 2]!, up[up.length - 1]!, q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const poly = (pts: number[][]) => "M" + pts.map((q) => `${f(q[0]!)} ${f(q[1]!)}`).join(" L") + " Z";
const bboxOf = (pts: Pt[]) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const; };

/**
 * The hat on the head at this yaw, as two layers: the parts behind the head (drawn before it) and the rest.
 * E is the camera tilt and IZ the plane of his face (from turn3d.ts).
 */
export function hat3d(name: string, yaw: number, E: number, IZ: number): { back: string; front: string; over: string } {
  const els = HATS[name], spec = SPECS[name];
  if (!els || !spec) return { back: "", front: "", over: "" };
  const s = SCALE[name] ?? 1.3;
  const cs0 = Math.cos(yaw * RAD), sn = Math.sin(yaw * RAD);
  const fa = ss(0.15, 0.35, cs0);                                     // painted on his face / a helmet's front
  const local = (xd: number) => 1 + s * (xd - 152);                   // drawing x → head-local x (151 is the head's middle)
  const Y0 = (yd: number) => 100 + s * (yd - 100);                    // drawing y → screen y (facing you)
  /** a drawing point on the plane at depth z that turns with his face */
  const cardPt = (z: number) => (x: number, y: number): Pt => { const xl = local(x); return [151 + xl * cs0 + z * sn, Y0(y) + E * (-xl * sn + z * (cs0 - 1))]; };
  const mapEl = (key: string, e: El, fn: (x: number, y: number) => Pt) => dOf(geo(key, e).map((q) => ({ closed: q.closed, p: q.p.map(([x, y]) => fn(x, y)) })));
  const sw = (e: El) => f(parseFloat(e.a["stroke-width"] ?? "7") * s);
  const swc = (e: El): Record<string, string> => (e.a["stroke-width"] ? { "stroke-width": sw(e) } : {});
  const kids = (i: number, k: Spec["k"]) => els.map((d, j) => ({ d, j })).filter(({ j }) => { const q = spec[j] as { k: string; parent?: number }; return !!q && q.k === k && q.parent === i; });
  const out: { z: number; behind: boolean; svg: string; i: number; w?: undefined | number; over?: boolean }[] = [];
  const st = SETTLE[name];
  const settle = (i: number, y: number) => (st && st.parts.includes(i) ? y + st.d * Math.abs(sn) * Math.max(0, Math.min(1, (st.y1 - y) / (st.y1 - st.y0))) : y);

  /* ---------- a round part as oval slices ---------- */
  const surf = (i: number) => {
    const sp = spec[i] as { zh: number; closed?: undefined | string; ell?: undefined | boolean; pe?: undefined | number; rim?: undefined | boolean };
    const T0 = tab(`${name}:${i}`, () => (sp.closed ? flatten({ tag: "path", a: { d: sp.closed } }) : geo(`${name}:${i}`, els[i]!)));
    // a round dome is widest at its rim: below the widest line (a rim drawn sloping, as on the guide's cap) the slices
    // stay as wide as the rim, so the rim does not narrow to a point
    let yW = T0.y1;
    if (sp.ell) { let mw = -1; for (let y = T0.y0; y <= T0.y1; y += 0.25) { const w = T0.at(y).w; if (w > mw + 1e-6) { mw = w; yW = y; } } }
    const T: Slices = sp.ell ? { y0: T0.y0, y1: yW, at: (y: number) => T0.at(Math.min(y, yW)) } : T0;
    let xh = 0; for (let y = T.y0; y <= T.y1; y += 1) xh = Math.max(xh, T.at(y).w * s);
    const k0 = sp.zh / Math.max(4, xh);                               // depth per unit of width: every slice is k times as deep as it is wide
    /** how deep each slice is for its width: the same for all (the part is its front outline made round), or, for a
        round dome, so its outline from the side is a half-ellipse zh deep at its base */
    const kAt = (y: number) => {
      if (!sp.ell) return k0;
      const h = Math.max(0, Math.min(1, (T.y1 - y) / (T.y1 - T.y0 || 1)));
      const pe = sp.pe ?? 2;
      return (sp.zh * Math.max(0.02, 1 - h ** pe) ** (1 / pe)) / Math.max(1, T.at(y).w * s);
    };
    const look = (y: number) => { const k = kAt(y); return { k, tt: Math.atan2(k * sn, cs0), Wf: Math.hypot(cs0, k * sn) }; };
    // a cap's rim: facing you its bottom is today's drawing (curving up in the middle); turned, it becomes the level
    // rim between its two lowest corners, and the bottom of the crown (its seam too) comes down with it
    let rimLine = (_x: number) => T.y1, warp = (_x: number, y: number) => y;
    if (sp.rim) {
      const outl = geo(`${name}:${i}`, els[i]!), pts = outl.flatMap((q) => q.p), [ax0, , ax1] = bboxOf(pts), xm = (ax0 + ax1) / 2;
      const lo = (side: number) => pts.filter(([x]) => (x - xm) * side > 0).reduce((A, B) => (B[1] > A[1] ? B : A));
      const Lc = lo(-1), Rc = lo(1);
      rimLine = (x: number) => Lc[1] + (Rc[1] - Lc[1]) * Math.max(0, Math.min(1, (x - Lc[0]) / (Rc[0] - Lc[0])));
      const NB = 60, bot: number[] = [];
      for (let k = 0; k <= NB; k++) {
        const x = Lc[0] + ((Rc[0] - Lc[0]) * Math.min(Math.max(k, 0.02), NB - 0.02)) / NB;
        let hi = -Infinity;
        for (const q of outl) for (let m = 0; m < q.p.length; m++) {
          const a = q.p[m]!, b = q.p[(m + 1) % q.p.length]!;
          if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) continue;
          hi = Math.max(hi, a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]));
        }
        bot.push(hi);
      }
      const bottomAt = (x: number) => { const t = Math.max(0, Math.min(NB, ((x - Lc[0]) / (Rc[0] - Lc[0])) * NB)), k = Math.min(NB - 1, Math.floor(t)), r = t - k; return bot[k]! + (bot[k + 1]! - bot[k]!) * r; };
      const K = ss(0, 1, Math.abs(sn));
      warp = (x: number, y: number) => {
        if (K <= 0) return y;
        const b = bottomAt(x), d = rimLine(x) - b;
        return d <= 0 ? y : y + d * K * Math.max(0, Math.min(1, 1 - (b - y) / 25));
      };
    }
    /** an outline point: the slice turned and seen from the front, its edge where the drawing's edge is */
    const sil = (x: number, y0: number): Pt => { const y = warp(x, y0), { c } = T.at(y), xc = local(c); return [151 + xc * cs0 + s * (x - c) * look(y).Wf, Y0(y) - E * xc * sn]; };
    /** a point on the part's surface (front half: half = 1; back half: -1): where it is now and how much it faces you */
    const wrap = (x: number, y0: number, half: 1 | -1 = 1): [number, number, number] => {
      const y = warp(x, y0), { c, w } = T.at(y), wl = w * s, xc = local(c), U = s * (x - c), { k, tt, Wf } = look(y);
      let cth = U / wl, extra = 0;
      if (cth > 1) { extra = U - wl; cth = 1; } else if (cth < -1) { extra = U + wl; cth = -1; }
      const th = Math.acos(cth) * half, v = Math.sin(th - tt), co = Math.cos(th - tt);
      const off = v >= 0 ? wl * Wf * co : wl * Wf * half * (tt >= 0 ? 1 : -1);  // a point turned away waits at the edge where its half shows (and hides)
      const xl = xc + wl * Math.cos(th) + extra, z = k * wl * Math.sin(th);
      return [151 + xc * cs0 + off + extra * cs0, Y0(y) + E * (-xl * sn + z * (cs0 - 1)), v];
    };
    return { T, kAt, sil, wrap, rimLine, rim: !!sp.rim, Zc: -local(T.at((T.y0 + T.y1) / 2).c) * sn };
  };

  /** small fixed parts: each piece keeps its shape, placed where its middle sits on the surface and narrowed as it turns */
  const fixedOn = (W: ReturnType<typeof surf>, d: El, key: string, fill: (d: El) => string, front?: { map: (x: number, y: number) => Pt; k: number }) => {
    return geo(key, d).map((q) => {
      const [x0, y0, x1, y1] = bboxOf(q.p), bx = (x0 + x1) / 2, by = (y0 + y1) / 2;
      let [Xa, Ya, v] = W.wrap(bx, by), h = 0.6;
      let ax = Math.max(0.04, Math.min(1.4, (W.wrap(bx + h, by)[0] - W.wrap(bx - h, by)[0]) / (2 * h * s)));
      let op = ss(-0.12, 0.04, v) * ss(0.18, 0.4, ax);
      if (front && front.k > 0) {
        // on a helmet's front (round its face opening) it sits where the front puts it; from behind, on the shell
        const k = front.k, [Xf, Yf] = front.map(bx, by), af = Math.max(0.04, Math.min(1, Math.abs(front.map(bx + h, by)[0] - front.map(bx - h, by)[0]) / (2 * h * s)));
        Xa = Xa + (Xf - Xa) * k; Ya = Ya + (Yf - Ya) * k; ax = ax + (af - ax) * k; op = op + (ss(0.18, 0.4, af) - op) * k;
      }
      if (op < 0.01) return "";
      const pts = q.p.map(([x, y]) => [Xa + ax * s * (x - bx), Ya + s * (y - by)] as Pt);
      return `<g opacity="${f(op)}">` + asPath(d, dOf([{ p: pts, closed: q.closed }]), { fill: fill(d), ...swc(d) }, VF) + `</g>`;
    }).join("");
  };

  /**
   * A helmet: a round shell (its closed outline) with the face opening on his face's plane, so the opening always frames
   * his face. Every point of today's drawing between the shell's outside edge and the opening's edge sits proportionally
   * between where the shell's edge is now and where the opening's edge is now. From behind it is the closed shell.
   */
  const helmet = (e: El, i: number, closedD: string) => {
    const W = surf(i), subs = geo(`${name}:${i}`, e), w = sw(e), fill = e.a["fill"] ?? "none", shade = SHADE[fill] ?? fill, lit = FRONT[fill] ?? fill;
    const closedSubs = flatten({ tag: "path", a: { d: closedD } }), card = cardPt(IZ);
    const xsAt = (y: number) => {
      const xs: number[] = [];
      for (const q of subs) for (let m = 0; m < q.p.length; m++) {
        const a = q.p[m]!, b = q.p[(m + 1) % q.p.length]!;
        if (!((a[1] <= y && y < b[1]) || (b[1] <= y && y < a[1]))) continue;   // half-open, so a corner on the line counts once
        xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
      return xs.sort((A, B) => A - B);
    };
    const hm = (x: number, y: number): Pt => {
      const { c, w: hw } = W.T.at(y), xs = xsAt(y), left = x < c;
      const xo = xs.length ? (left ? xs[0]! : xs[xs.length - 1]!) : left ? c - hw : c + hw;
      let xn = c;
      if (xs.length >= 4) { const inner = left ? xs.filter((v) => v < c).pop() : xs.find((v) => v > c); if (inner !== undefined) xn = inner; }
      const t = Math.abs(xn - xo) < 1e-6 ? 1 : (x - xo) / (xn - xo);
      if (t >= 1) return card(x, y);                                   // in the opening or its middle: on his face's plane
      const A = W.sil(xo, y), B = card(xn, y), u = Math.max(0, t);
      return [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u];
    };
    const front = cs0 > 0.06;
    const outline = front ? subs.map((q) => ({ closed: q.closed, p: q.p.map(([x, y]) => hm(x, y)) })) : closedSubs.map((q) => ({ closed: q.closed, p: q.p.map(([x, y]) => W.sil(x, y)) }));
    const od = dOf(outline), id = `hc${++CLIP_SEQ}`;
    let svg = asPath(e, od, { fill: shade, "stroke-width": w, class: null, "fill-opacity": null });
    let inner = "";
    if (front) {
      // its lit front plate turns with his face; the shell round it is in shade
      inner += `<g opacity="${f(ss(0.06, 0.3, cs0))}">` + asPath(e, mapEl(`${name}:${i}`, e, card), { fill: lit, stroke: "none", class: null, "fill-opacity": null }) + `</g>`;
    } else {
      const bop = ss(-0.3, 0.15, -cs0);
      if (bop > 0.01) inner += `<g opacity="${f(bop)}">` + asPath(e, dOf(closedSubs.map((q) => ({ closed: q.closed, p: q.p.map(([x, y]) => W.wrap(x, y, -1).slice(0, 2) as Pt) }))), { fill: lit, stroke: "none", class: null, "fill-opacity": null }) + `</g>`;
    }
    if (inner) svg += `<clipPath id="${id}"><path d="${od}"/></clipPath><g clip-path="url(#${id})">${inner}</g>` + asPath(e, od, { fill: "none", "stroke-width": w, class: null, "fill-opacity": null });
    if (front) {
      const dop = ss(0.06, 0.12, cs0);
      for (const { d, j } of kids(i, "decal")) if (dop > 0.01) svg += `<g opacity="${f(dop)}">` + asPath(d, mapEl(`${name}:${j}`, d, hm), swc(d)) + `</g>`;
      for (const { d, j } of kids(i, "on")) if (dop > 0.01) svg += `<g opacity="${f(dop)}">` + asPath(d, mapEl(`${name}:${j}`, d, hm), { fill: FRONT[d.a["fill"] ?? ""] ?? d.a["fill"] ?? "none", ...swc(d) }) + `</g>`;
    }
    // screws and side lines: on the front while it shows, on the shell from behind
    for (const { d, j } of kids(i, "side")) svg += fixedOn(W, d, `${name}:${j}`, (q) => FRONT[q.a["fill"] ?? ""] ?? q.a["fill"] ?? "none", front ? { map: hm, k: ss(0.06, 0.3, cs0) } : undefined);
    return { z: W.Zc, behind: W.Zc < -30, svg, i };
  };

  els.forEach((e, i) => {
    const sp = spec[i];
    if (!sp || sp.k === "skip" || sp.k === "decal" || sp.k === "on" || sp.k === "side") return;
    const fill = e.a["fill"] ?? "none", shade = SHADE[fill] ?? fill, lit = FRONT[fill] ?? fill;

    if (sp.k === "round" && sp.closed) { out.push(helmet(e, i, sp.closed)); return; }

    if (sp.k === "round") {
      const W = surf(i), subs = geo(`${name}:${i}`, e), w = sw(e), id = `hc${++CLIP_SEQ}`;
      const flat = sp.p === "disk";       // a disk (brim, pad, fin) is lit all over; a dome or band has a lit front and back
      const silD = dOf(subs.map((q) => ({ p: q.p.map(([x, y]) => W.sil(x, y)), closed: q.closed })));
      let svg = asPath(e, silD, { fill: flat ? lit : shade, "stroke-width": w, class: null, "fill-opacity": null }, VF);
      let inner = "";
      let paint = "";                           // painted details go over the part's outline, as drawn today
      if (!flat) {
        // the front half (today's drawing, wrapped round the slices) and, seen from behind, the back half
        for (const half of [1, -1] as const) {
          const op = ss(-0.3, 0.15, half * cs0);
          if (op < 0.01) continue;
          inner += `<g opacity="${f(op)}">` + asPath(e, dOf(subs.map((q) => ({ p: q.p.map(([x, y]) => W.wrap(x, y, half).slice(0, 2) as Pt), closed: q.closed }))), { fill: lit, stroke: "none", class: null, "fill-opacity": null }) + `</g>`;
        }
      }
      // painted details: point by point on the surface (a disk squeezes them with it; a helmet's turn with his face)
      for (const { d, j } of kids(i, "decal")) {
        let parts = geo(`${name}:${j}`, d);
        if ((spec[j] as { seam?: undefined | boolean }).seam) {
          // a seam round a band: facing you it runs midway between the band's top and bottom edges, so it curves the way
          // the band itself is drawn; as he turns it straightens to the level line a seam really is, and goes all the
          // way round. (The drawn curve as it was, wrapped round the band, cut across it as he turned.)
          const [bx0, , bx1] = bboxOf(subs.flatMap((q) => q.p)), K = ss(0, 1, Math.abs(sn));
          const edges = (x: number) => { let lo = Infinity, hi = -Infinity; for (const q of subs) for (let m = 0; m < q.p.length; m++) { const a = q.p[m]!, b = q.p[(m + 1) % q.p.length]!; if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) continue; const y = a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]); lo = Math.min(lo, y); hi = Math.max(hi, y); } return [lo, hi] as const; };
          const [mlo, mhi] = edges((bx0 + bx1) / 2), yLevel = (mlo + mhi) / 2, pts: Pt[] = [];
          for (let k = 0; k <= 40; k++) { const x = bx0 + 1 + ((bx1 - bx0 - 2) * k) / 40, [lo, hi] = edges(x), yc = lo === Infinity ? yLevel : (lo + hi) / 2; pts.push([x, yc + (yLevel - yc) * K]); }
          parts = [{ p: pts, closed: false }];
        }
        if (flat) { paint += asPath(d, dOf(parts.map((q) => ({ p: q.p.map(([x, y]) => W.sil(x, y)), closed: q.closed }))), swc(d), VF); continue; }
        const all = parts.flatMap((q) => q.p), [x0, y0, x1, y1] = bboxOf(all), bx = (x0 + x1) / 2, by = (y0 + y1) / 2, h = 0.6;
        const filled = !!d.a["fill"] && d.a["fill"] !== "none";
        for (const half of ((spec[j] as { ring?: undefined | boolean }).ring ? [1, -1] : [1]) as (1 | -1)[]) {
          let vmax = -1;
          const mapped = parts.map((q) => ({ closed: q.closed, p: q.p.map(([x, y]) => { const r = W.wrap(x, y, half); vmax = Math.max(vmax, r[2]); return [r[0], r[1]] as Pt; }) }));
          // a filled patch seen edge-on fades rather than becoming a black line
          const ax = Math.abs(W.wrap(bx + h, by, half)[0] - W.wrap(bx - h, by, half)[0]) / (2 * h * s);
          const op = ss(-0.15, 0.02, vmax) * (filled ? ss(0.18, 0.42, ax) : 1);
          const wd = filled && d.a["stroke-width"] ? { "stroke-width": f(parseFloat(d.a["stroke-width"]) * s * Math.max(0.35, Math.min(1, ax))) } : swc(d);
          if (op > 0.01) paint += `<g opacity="${f(op)}">` + asPath(d, dOf(mapped), wd, VF) + `</g>`;
        }
      }
      if (inner || paint) svg += `<clipPath id="${id}"><path d="${silD}"/></clipPath>`;
      if (inner) svg += `<g clip-path="url(#${id})">${inner}</g>` + asPath(e, silD, { fill: "none", "stroke-width": w, class: null, "fill-opacity": null }, VF);
      if (paint) svg += `<g clip-path="url(#${id})">${paint}</g>`;
      // fixed on its front (logos, badges, goggles, a buckle)
      for (const { d, j } of kids(i, "on")) svg += fixedOn(W, d, `${name}:${j}`, (q) => FRONT[q.a["fill"] ?? ""] ?? q.a["fill"] ?? "none");
      out.push({ z: W.Zc, behind: W.Zc < -30, svg, i });
      return;
    }

    if (sp.k === "plate") {
      // a brim or visor: today's drawing given depth, its top edge on the crown's rim, its bottom edge reaching out L
      const P = surf(sp.parent), subs = geo(`${name}:${i}`, e), all = subs.flatMap((q) => q.p);
      const [bx0, by0, bx1] = bboxOf(all);
      const rim = P.T.at(Math.max(P.T.y0, Math.min(P.T.y1, by0 + 2))), wr = rim.w * s, xr = local(rim.c);
      const kr = P.kAt(Math.max(P.T.y0, Math.min(P.T.y1, by0 + 2)));
      const R0 = Math.max(...all.map(([x]) => Math.abs(local(x) - xr))) + 1, zr0 = kr * wr;
      const uNear = Math.min(...all.map(([x]) => Math.abs(local(x) - xr)));
      // the crown's rim in its middle (front and back): where a bill worn backwards meets it seen from behind
      const pe = els[sp.parent]!, pc = (bboxOf(geo(`${name}:${sp.parent}`, pe).flatMap((q) => q.p))[0] + bboxOf(geo(`${name}:${sp.parent}`, pe).flatMap((q) => q.p))[2]) / 2;
      let rimMid = -Infinity;
      for (const q of geo(`${name}:${sp.parent}`, pe)) for (let m = 0; m < q.p.length; m++) {
        const a = q.p[m]!, b = q.p[(m + 1) % q.p.length]!;
        if ((a[0] - pc) * (b[0] - pc) > 0 || a[0] === b[0]) continue;
        rimMid = Math.max(rimMid, a[1] + ((pc - a[0]) * (b[1] - a[1])) / (b[0] - a[0]));
      }
      // top and bottom of the drawing along x
      const NX = 40, top: number[] = [], bot: number[] = [];
      for (let k = 0; k <= NX; k++) {
        const x = bx0 + ((bx1 - bx0) * Math.min(Math.max(k, 0.05), NX - 0.05)) / NX;
        let lo = Infinity, hi = -Infinity;
        for (const q of subs) for (let m = 0; m < q.p.length; m++) {
          const a = q.p[m]!, b = q.p[(m + 1) % q.p.length]!;
          if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) continue;
          const y = a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]); lo = Math.min(lo, y); hi = Math.max(hi, y);
        }
        top.push(lo === Infinity ? by0 : lo); bot.push(hi === -Infinity ? by0 : hi);
      }
      const tb = (x: number) => { const t = Math.max(0, Math.min(NX, ((x - bx0) / (bx1 - bx0)) * NX)), k = Math.min(NX - 1, Math.floor(t)), r = t - k; return [top[k]! + (top[k + 1]! - top[k]!) * r, bot[k]! + (bot[k + 1]! - bot[k]!) * r] as const; };
      const map = (x: number, y: number): [number, number, number] => {
        const u = local(x) - xr, zrim = (v: number) => kr * Math.sqrt(Math.max(0, wr * wr - v * v));
        const [t0, t1] = tb(x), t = Math.max(0, Math.min(1, (y - t0) / Math.max(0.5, t1 - t0)));
        let zr: number, zo: number;
        if (sp.reach !== undefined) {
          // a bill: from where it leaves the rim it keeps going out behind (or in front), the further out the further back
          zr = Math.max(zrim(u), zrim(uNear) + sp.reach * Math.max(0, Math.abs(u) - uNear)); zo = zr + sp.L;
        } else {
          zr = zrim(u); zo = Math.max(zr, (zr0 + sp.L) * Math.sqrt(Math.max(0, 1 - (u / R0) ** 2)));
        }
        const z = sp.side * (zr + t * (zo - zr)), xl = local(x);
        // a bill worn backwards hangs down beside his head only as drawn facing you; turned, it stays level with the rim
        const turned = ss(0, 1, 1 - cs0);
        // on a cap with a drawn rim (curving up), the visor's root is drawn curving up with it; turned, it is fixed
        // along the level rim, so the whole visor comes down with its root and its edge bulges out, not in
        const lv = P.rim ? Math.max(0, P.rimLine(x) - 1 - t0) * ss(0, 1, Math.abs(sn)) : 0;
        const yv = sp.reach !== undefined ? by0 + (y - by0) * (1 - 0.92 * turned) - (by0 - rimMid + 3) * turned : y + lv;
        return [151 + xl * cs0 + z * sn, Y0(yv) + E * (-xl * sn + z * (cs0 - 1)), -xl * sn + z * cs0];
      };
      const th = sp.th * (s / 1.3) * ss(0, 0.6, Math.abs(sn)), w = sw(e);
      const topPts = subs.map((q) => ({ closed: q.closed, p: q.p.map(([x, y]) => map(x, y)) }));
      const Zc = topPts[0]!.p.reduce((a, q) => a + q[2], 0) / topPts[0]!.p.length;
      const flat2 = (qs: typeof topPts, dy: number) => qs.map((q) => ({ closed: q.closed, p: q.p.map((r) => [r[0], r[1] + dy] as Pt) }));
      // its thickness under it, one outline round both, and the edge of its top: thinner as it turns edge-on, so seen
      // from the side it is a lit edge with its thickness under it, not a black bar
      const topD = dOf(flat2(topPts, 0)), lowD = th > 0.3 ? dOf(flat2(topPts, th)) : "";
      let svg = lowD ? `<path d="${topD} ${lowD}" fill="${INK}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"/><path d="${lowD}" fill="${shade}"/>` : "";
      svg += asPath(e, topD, { fill: lit, "stroke-width": lowD ? f(Number(w) * (0.45 + 0.55 * Math.abs(cs0))) : w }, VF);
      for (const { d, j } of kids(i, "decal")) svg += asPath(d, dOf(geo(`${name}:${j}`, d).map((q) => ({ closed: q.closed, p: q.p.map(([x, y]) => map(x, y).slice(0, 2) as Pt) }))), swc(d), VF);
      out.push({ z: Zc, behind: Zc < -30 && cs0 < 0.97, svg, i });   // facing you it lies over his head, as drawn today
      return;
    }

    if (sp.k === "peak") {
      const [gam, dphi, L, q, droop, pw, c, yr, yb] = sp.p as [number, number, number, number, number, number, number, number, number], zr = (spec[sp.parent] as { zh: number }).zh / s;
      const pe = els[sp.parent]!, [px0, , px1] = bboxOf(geo(`${name}:${sp.parent}`, pe).flatMap((qq) => qq.p));
      const XC = (px0 + px1) / 2, WR = (px1 - px0) / 2, NU = 16, NT = 9, phi0 = Math.PI - gam, ox = -Math.cos(gam), oz = Math.sin(gam);
      // the peak's top surface, point by point (drawing units: x, y, depth)
      const P: [number, number, number][][] = [];
      for (let a = 0; a <= NU; a++) {
        const u = -1 + (2 * a) / NU, ph = phi0 - u * dphi, rx = XC + WR * Math.cos(ph), rz = zr * Math.sin(ph), Du = L * Math.max(0, 1 - u * u) ** q, row: [number, number, number][] = [];
        for (let b = 0; b <= NT; b++) { const t = b / NT, k = (t * Du) / L; row.push([rx + t * Du * ox, yr + yb * u * u + droop * k ** pw + c * u * u * k, rz + t * Du * oz]); }
        P.push(row);
      }
      const scr = ([x, y, z]: [number, number, number], dy = 0): [number, number, number] => {
        const xl = local(x), zl = s * z; return [151 + xl * cs0 + zl * sn, Y0(y) + dy + E * (-xl * sn + zl * (cs0 - 1)), -xl * sn + zl * cs0];
      };
      const th = 5 * (s / 1.3);
      // each small piece: lit by how much it faces up and toward the light (top-left), darker underneath
      const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i]! - v) * t)).join(",")})`;
      const TOP_D = [74, 35, 137], TOP_L = [139, 82, 224], UND_D = [44, 20, 92], UND_L = [70, 34, 130];
      const quads: { z: number; d: string; fill: string }[] = [];
      for (let a = 0; a < NU; a++) for (let b = 0; b < NT; b++) {
        const c3 = [P[a]![b]!, P[a + 1]![b]!, P[a + 1]![b + 1]!, P[a]![b + 1]!];
        const pts = c3.map((v) => scr(v));
        // its normal, turned with him: (tu × tt), where y is down
        const L3 = c3.map(([x, y, z]) => [s * x, s * y, s * z]);
        const du = [L3[1]![0]! - L3[0]![0]!, L3[1]![1]! - L3[0]![1]!, L3[1]![2]! - L3[0]![2]!], dt = [L3[3]![0]! - L3[0]![0]!, L3[3]![1]! - L3[0]![1]!, L3[3]![2]! - L3[0]![2]!];
        let n = [du[1]! * dt[2]! - du[2]! * dt[1]!, du[2]! * dt[0]! - du[0]! * dt[2]!, du[0]! * dt[1]! - du[1]! * dt[0]!];
        const nl = Math.hypot(n[0]!, n[1]!, n[2]!) || 1; n = n.map((v) => v / nl);
        if (n[1]! > 0) n = n.map((v) => -v);                               // the top side's normal points up
        const nz = -n[0]! * sn + n[2]! * cs0, ny = n[1]!, see = nz - E * ny;  // > 0: the top side faces you
        const nx = n[0]! * cs0 + n[2]! * sn, light = Math.max(0, Math.min(1, 0.3 + 0.8 * (-0.42 * nx - 0.72 * ny + 0.55 * nz)));
        const fill = see >= 0 ? mix(TOP_D, TOP_L, light) : mix(UND_D, UND_L, light * 0.6);
        quads.push({ z: pts.reduce((q, v) => q + v[2], 0) / 4, d: poly(pts), fill });
        if (b === NT - 1) {
          // its thickness along the outer edge
          const e0 = scr(P[a]![NT]!), e1 = scr(P[a + 1]![NT]!), e2 = scr(P[a + 1]![NT]!, th), e3 = scr(P[a]![NT]!, th);
          quads.push({ z: (e0[2] + e1[2]) / 2 + 0.5, d: poly([e0, e1, e2, e3]), fill: mix(UND_D, UND_L, 0.4) });
        }
      }
      quads.sort((A, B) => A.z - B.z);
      const w = sw(e), all = quads.map((q) => q.d).join(" ");
      // its outline: every piece stroked thick underneath, then the pieces on top (so only the outside edge shows)
      // (a base fill under the pieces, so no hairline gaps show between them)
      const svg = `<path d="${all}" fill="${INK}" stroke="${INK}" stroke-width="${f(Number(w) * 1.05)}" stroke-linejoin="round"/>`
        + `<path d="${all}" fill="${mix(TOP_D, TOP_L, 0.45)}"/>`
        + quads.map((q) => `<path d="${q.d}" fill="${q.fill}" stroke="${q.fill}" stroke-width="1" stroke-linejoin="round"/>`).join("");
      const Zm = quads.reduce((q, v) => q + v.z, 0) / quads.length;
      const crownZ = surf(sp.parent).Zc;
      out.push({ z: Zm < -30 ? Zm : crownZ, behind: Zm < -30, svg, i });
      return;
    }

    if (sp.k === "ribbon") {
      // the drawing's thick line as a strip: as wide as today's line, hz deep. The half on the far side of his head goes
      // behind it; the near half lies over it (it is drawn twice: the "over" copy is clipped to his head by turn3d).
      const line = geo(`${name}:${i}`, e)[0]!.p.map(([x, y]) => [x, settle(i, y)] as Pt), fe = els[sp.fill]!;
      const tR = parseFloat(fe.a["stroke-width"] ?? "10") / 2, ow = (parseFloat(e.a["stroke-width"] ?? "20") / 2 - tR) * 2 * s;
      const col = fe.a["stroke"] ?? "#8b45d9", litC = FRONT[col] ?? col;
      const P3 = (x: number, y: number, z: number): Pt => { const xl = local(x); return [151 + xl * cs0 + z * sn, Y0(y) + E * (-xl * sn + z * (cs0 - 1))]; };
      const secs = line.map((q, k) => {
        const a = line[Math.max(0, k - 1)]!, b = line[Math.min(line.length - 1, k + 1)]!, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L, ny = dx / L;
        return [-1, 1].flatMap((r) => [-1, 1].map((d) => P3(q[0] + r * tR * nx, q[1] + r * tR * ny, d * sp.hz)));
      });
      const segs = secs.slice(0, -1).map((sc, k) => ({ d: poly(hull([...sc, ...secs[k + 1]!])), z: -local((line[k]![0] + line[k + 1]![0]) / 2) * sn }));
      const draw = (list: typeof segs) => list.length ? `<path d="${list.map((q) => q.d).join(" ")}" fill="${INK}" stroke="${INK}" stroke-width="${f(ow)}" stroke-linejoin="round"/>`
        + `<path d="${list.map((q) => q.d).join(" ")}" fill="${litC}"/>` : "";
      out.push({ z: -1e3, behind: true, svg: draw(segs), i });
      const near = segs.filter((q) => q.z > -3);
      if (near.length) out.push({ z: 0, behind: false, over: true, svg: draw(near), i });
      return;
    }

    if (sp.k === "face") {
      // on his face: turns with it, fades as it turns away
      if (fa > 0.01) out.push({ z: 1e3, behind: false, svg: `<g opacity="${f(fa)}">` + asPath(e, mapEl(`${name}:${i}`, e, cardPt(IZ)), swc(e)) + `</g>`, i });
      return;
    }

    if (sp.k === "board") { out.push({ z: 0, behind: false, svg: board(e), i }); return; }

    if (sp.k === "onboard") {
      // on the board's top it turns with the board; below the point it hangs from, it hangs straight down from there
      const B = els.findIndex((_, j) => spec[j]?.k === "board"), [bx0, by0, bx1, by1] = bboxOf(geo(`${name}:${B}`, els[B]!).flatMap((q) => q.p));
      const cx = (bx0 + bx1) / 2, yc = Y0((by0 + by1) / 2), Eb = (by1 - by0) / (bx1 - bx0), lc = local(cx);
      const onB = (x: number, y: number): [number, number, number] => {
        const xl = local(x) - lc, z = (Y0(y) - yc) / Eb;
        return [151 + lc + xl * cs0 + z * sn, yc + Eb * (-xl * sn + z * cs0), -(lc + xl) * sn + z * cs0];
      };
      const subs = geo(`${name}:${i}`, e), fillC: Record<string, string> = e.a["fill"] && e.a["fill"] !== "none" ? { fill: FRONT[e.a["fill"]] ?? e.a["fill"] } : {};
      const anchor = sp.hang ? onB(sp.hang[0], sp.hang[1]) : null;
      const hang = (x: number, y: number): Pt => [anchor![0] + s * (x - sp.hang![0]), anchor![1] + s * (y - sp.hang![1])];
      if (sp.rigid) {
        // a round button or the tassel's end: keeps its shape where its middle is
        const [x0, y0, x1, y1] = bboxOf(subs.flatMap((q) => q.p)), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        const [Xm, Ym, Zm] = anchor ? [...hang(mx, my), anchor[2]] : onB(mx, my);
        const d = dOf(subs.map((q) => ({ closed: q.closed, p: q.p.map(([x, y]) => [Xm + s * (x - mx), Ym + s * (y - my)] as Pt) })));
        out.push({ z: anchor ? Zm : 0, behind: !!anchor && Zm < -30, svg: asPath(e, d, { ...fillC, ...swc(e) }, VF), i });
        return;
      }
      const top: Sub[] = [], low: Sub[] = [];
      for (const q of subs) {
        const a: Pt[] = [], b: Pt[] = [];
        for (const [x, y] of q.p) {
          if (!sp.hang || y <= sp.hang[1] + 0.01) a.push(onB(x, y).slice(0, 2) as Pt);
          else { if (!b.length) b.push(hang(sp.hang[0], sp.hang[1])); b.push(hang(x, y)); }
        }
        if (a.length > 1) top.push({ p: a, closed: q.closed && !b.length });
        if (b.length > 1) low.push({ p: b, closed: false });
      }
      if (top.length) out.push({ z: 0, behind: false, svg: asPath(e, dOf(top), { ...fillC, ...swc(e) }, VF), i });
      if (low.length) out.push({ z: anchor![2], behind: anchor![2] < -30, svg: asPath(e, dOf(low), { ...fillC, ...swc(e) }, VF), i });
      return;
    }

    // a small free part or a thick line, swept through its depth
    const [z0, z1] = sp.z, [bx0, , bx1] = bboxOf(geo(`${name}:${i}`, e).flatMap((q) => q.p)), xc = local((bx0 + bx1) / 2), zc = (z0 + z1) / 2;
    const Zc = -xc * sn + zc * cs0;
    if (sp.k === "slab") {
      const half = Math.max(2, ((bx1 - bx0) / 2) * s), dz = Math.abs(z1 - z0);
      const Wd = Math.max(0.05, (2 * half * Math.abs(cs0) + dz * Math.abs(sn)) / (2 * half)), X = xc * cs0 + zc * sn;
      const mx = (bx0 + bx1) / 2, dy = E * (-xc * sn + zc * (cs0 - 1));
      const d = mapEl(`${name}:${i}`, e, (x, y) => [151 + X + Wd * s * (x - mx), Y0(settle(i, y)) + dy]);
      out.push({ z: Zc, behind: Zc < -30, svg: asPath(e, d, { fill: lit, ...swc(e) }), i, w: sp.w });
      return;
    }
    const n = Math.max(2, Math.min(40, Math.ceil((Math.abs(z1 - z0) * Math.max(Math.abs(sn), 0.3)) / 2) + 1));
    const zs = Array.from({ length: n }, (_, k) => z0 + ((z1 - z0) * k) / (n - 1)).sort((A, B) => A * cs0 - B * cs0);
    const col = e.a["stroke"] ?? INK, cshade = SHADE[col] ?? col;
    // a ring (a strap round a crown) narrows with the crown's round section toward the front and back
    let ringC = 0, ringZ = 1;
    if (sp.ring !== undefined) {
      const P = surf(sp.ring), all = geo(`${name}:${i}`, e).flatMap((q) => q.p), ym = all.reduce((a, q) => a + q[1], 0) / all.length;
      const sl = P.T.at(ym); ringC = sl.c; ringZ = P.kAt(ym) * sl.w * s;
    }
    const svg = zs.map((z, k) => {
      const kk = sp.ring !== undefined ? Math.sqrt(Math.max(0.0025, 1 - (z / ringZ) ** 2)) : 1;
      const at = cardPt(z);
      return asPath(e, mapEl(`${name}:${i}`, e, (x, y) => at(ringC + kk * (x - ringC), settle(i, y))), { stroke: k === zs.length - 1 ? col : cshade, "stroke-width": sw(e), class: null });
    }).join("");
    out.push({ z: Zc, behind: Zc < -30, svg, i });
  });
  // a part layered with another (the beret's ball on its stem) sorts with it
  for (const q of out) if (q.w !== undefined) { const o = out.find((r) => r.i === q.w); if (o) { q.z = o.z; q.behind = o.behind; q.i = o.i + 0.5; } }

  function board(e: El) {
    // the mortarboard: a square board, its corner toward you, seen from a little above (as drawn today)
    const [bx0, by0, bx1, by1] = bboxOf(geo(`${name}:${els!.indexOf(e)}`, e).flatMap((q) => q.p)), cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
    const yc = 100 + s * (cy - 100), h = ((bx1 - bx0) / 2) * s, Eb = (by1 - by0) / (bx1 - bx0), th = 8 * ss(0, 0.5, Math.abs(sn));
    const corners = [[h, 0], [0, h], [-h, 0], [0, -h]].map(([x, z]) => [151 + local(cx) + x! * cs0 + z! * sn, yc + Eb * (-x! * sn + z! * cs0)]);
    const top = corners, bot = corners.map(([x, y]) => [x!, y! + th]);
    return `<path d="${poly(hull([...top, ...bot]))}" fill="#4a2389" stroke="${INK}" stroke-width="${f(7 * s)}" stroke-linejoin="round"/>`
      + `<path d="${poly(top)}" fill="url(#bq-pg)" stroke="${INK}" stroke-width="${f(7 * s)}" stroke-linejoin="round"/>`;
  }

  // nearer parts over farther ones; parts within a few units of each other keep today's layering (a crown, its band,
  // its lid and its brim are all round the same middle and must not swap as he turns)
  const layer = (z: number) => Math.round(z / 14);
  out.sort((A, B) => layer(A.z) - layer(B.z) || A.i - B.i);
  return { back: out.filter((q) => q.behind).map((q) => q.svg).join(""), front: out.filter((q) => !q.behind && !q.over).map((q) => q.svg).join(""),
    over: out.filter((q) => q.over).map((q) => q.svg).join("") };
}
