/* Phase 3 (Nov 9, approved in the turnaround mock v4.13): the parts of Bloq's body that change with the angle he
   faces: the backpack (a soft box on his back, with today's seam, zip pull and highlight on the side you see, the pocket
   and stripe on its back when he turns away) and the single strap over the shoulder nearer you, as drawn today. The
   torso is round, so today's drawing serves at every angle; the limbs are the engine's rig. */

import { proj, facing, depth, hull, poly, type V2, type V3 } from "./head3d";

const INK = "#1b1622", P = "#8b45d9", PD = "#6630b3", PL = "#b47ff0", L = "#d4f033";
const o = `stroke="${INK}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"`;
const f = (n: number) => n.toFixed(1);
const ss = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** the body's axis in the figure's coordinates; parts give their own y */
const C: V2 = [152, 0];

function smooth(pts: V2[]) {
  if (pts.length < 2) return "";
  let d = `M${f(pts[0]![0])} ${f(pts[0]![1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}
function softBox(c3: V3, half: V3, r: number, yaw: number) {
  const all: V2[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const q = proj([c3[0] + sx * (half[0] - r), c3[1] + sy * (half[1] - r), c3[2] + sz * (half[2] - r)], yaw, C);
    for (let i = 0; i < 20; i++) { const t = (i / 20) * Math.PI * 2; all.push([q[0] + r * Math.cos(t), q[1] + r * Math.sin(t)]); }
  }
  return hull(all);
}

/* The strap over his right shoulder (the one you see today), from the top of the pack, over the shoulder and down the
   chest to where his hand holds it. Local points; they turn with the body. */
const STRAP: V3[] = [[-21, 203, -26], [-25, 198, -6], [-19, 211, 15], [-9, 230, 24], [-3, 247, 25]];
function strapPoints(n = 28): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < STRAP.length - 1; i++) {
    const p0 = STRAP[Math.max(0, i - 1)]!, p1 = STRAP[i]!, p2 = STRAP[i + 1]!, p3 = STRAP[Math.min(STRAP.length - 1, i + 2)]!;
    const m = Math.ceil(n / (STRAP.length - 1));
    for (let j = 0; j < m; j++) {
      const t = j / m, t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map((k) => 0.5 * ((2 * p1[k]!) + (-p0[k]! + p2[k]!) * t + (2 * p0[k]! - 5 * p1[k]! + 4 * p2[k]! - p3[k]!) * t2 + (-p0[k]! + 3 * p1[k]! - 3 * p2[k]! + p3[k]!) * t3)) as V3);
    }
  }
  out.push(STRAP[STRAP.length - 1]!);
  return out;
}
const STRAP_PTS = strapPoints();
/** Where the strap ends (the hand holds it there), for the shoulder side sd (-1 his right, +1 his left), at this yaw. */
export function strapEnd(sd: -1 | 1, yaw: number): V2 { const e = STRAP[STRAP.length - 1]!; return proj([-sd * e[0], e[1], e[2]], yaw, C); }

/** Which shoulder the strap is on for a yaw: the one nearer you (-1 his right when he faces right). */
export const strapFor = (yaw: number) => (Math.sin(yaw * (Math.PI / 180)) >= 0 ? -1 : 1);
/** The strap's shoulder during a turn: one fades out as the other fades in around facing you (-1..1). */
export const strapSmooth = (yaw: number) => (yaw === 0 ? -1 : Math.max(-1, Math.min(1, -Math.sin(yaw * (Math.PI / 180)) / Math.sin(12 * (Math.PI / 180)))));

/** The strap at this yaw: -1 over his right shoulder, +1 his left; in between, both, fading. Only the part on the side
    of him that faces you is drawn. */
export function strapSvg(yaw: number, strap = strapSmooth(yaw)): string {
  return ([-1, 1] as const).map((sd) => {
    const w = sd < 0 ? (1 - strap) / 2 : (1 + strap) / 2;
    if (w < 0.02) return "";
    const sp = STRAP_PTS.map((q) => { const p: V3 = [-sd * q[0], q[1], q[2]]; return { q2: proj(p, yaw, C), seen: facing([p[0], 0, p[2]], yaw) > -2 || p[2] < -20 }; });
    const runs: V2[][] = [];
    sp.forEach((s_, i) => { if (!s_.seen) return; if (i === 0 || !sp[i - 1]!.seen) runs.push([]); runs[runs.length - 1]!.push(s_.q2); });
    return `<g opacity="${w.toFixed(3)}">` + runs.filter((r) => r.length > 1).map((r) => { const d = smooth(r); return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${P}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`; }).join("") + `</g>`;
  }).join("");
}

/** The backpack at this yaw. `behind` is true when it is behind the torso (he faces you), false when in front of it
    (he faces away). The agent's wearable sits on it in the agent outfit (kept by the engine's CSS). */
export function packSvg(yaw: number): { svg: string; z: number } {
  const PC: V3 = [0, 240, -36], PH: V3 = [29, 51, 22];
  let svg = `<path d="${poly(softBox(PC, PH, 16, yaw))}" fill="url(#bq-pg)" ${o}/>`;
  const sideK = Math.max(facing([-1, 0, 0], yaw), facing([1, 0, 0], yaw));
  if (sideK > 0.25) {
    const sx = facing([-1, 0, 0], yaw) > facing([1, 0, 0], yaw) ? -1 : 1;
    const on = (u: number, y: number): V2 => proj([sx * PH[0], y, PC[2] - PH[2] + (sx < 0 ? u : 1 - u) * 2 * PH[2]], yaw, C);
    const path = (pts: [number, number][]) => smooth(pts.map(([u, y]) => on(u, y)));
    const al = ss(0.25, 0.5, sideK).toFixed(2);
    svg += `<g opacity="${al}">`
      + `<path d="${path([[0.08, 246], [0.3, 252], [0.62, 253], [0.9, 247]])}" fill="none" stroke="${PD}" stroke-width="4" stroke-linecap="round"/>`
      + `<path d="${path([[0.06, 258], [0.18, 276], [0.45, 284], [0.78, 282]])}" fill="none" stroke="${PD}" stroke-width="8" stroke-linecap="round" opacity=".55"/>`
      + `<path d="${path([[0.26, 214], [0.4, 205], [0.6, 202]])}" fill="none" stroke="${PL}" stroke-width="5" stroke-linecap="round"/>`
      + `<path d="${path([[0.33, 252], [0.36, 262], [0.48, 269]])}" fill="none" stroke="${L}" stroke-width="5" stroke-linecap="round"/></g>`;
  }
  const backK = facing([0, 0, -1], yaw);
  if (backK > 0.2) {
    const m = (x: number, y: number) => proj([x, y, PC[2] - PH[2]], yaw, C);
    const a1 = m(-18, 256), a2 = m(18, 256), b1 = m(-12, 272), b2 = m(12, 272), s1 = m(-15, 214), s2 = m(-13, 230);
    svg += `<g opacity="${ss(0.2, 0.6, backK).toFixed(2)}"><path d="M${f(a1[0])} ${f(a1[1])} Q${f((a1[0] + a2[0]) / 2)} ${f(a1[1] + 16)} ${f(a2[0])} ${f(a2[1])}" fill="none" stroke="${PD}" stroke-width="5"/>`
      + `<path d="M${f(b1[0])} ${f(b1[1])} L${f(b2[0])} ${f(b2[1])}" stroke="${L}" stroke-width="5" stroke-linecap="round"/>`
      + `<path d="M${f(s1[0])} ${f(s1[1])} L${f(s2[0])} ${f(s2[1])}" stroke="${PL}" stroke-width="5" stroke-linecap="round"/></g>`;
  }
  return { svg, z: depth([0, 0, PC[2]], yaw) };
}

/** Today's torso: round, so it reads the same from every side (the light stays top-left). */
export const TORSO = `<path d="M131 197 C121 230 121 270 132 291 C143 303 161 303 172 291 C183 270 183 230 173 197 Z" fill="url(#bq-wg)" ${o}/>`
  + `<path d="M166 206 C176 232 178 262 170 287 C164 293 158 295 150 295 C161 278 167 246 166 206 Z" fill="#ebe5f6"/>`
  + `<path d="M136 200 C146 213 158 213 168 200" fill="none" stroke="#3a2a5c" stroke-width="10" stroke-linecap="round" opacity=".12"/>`;
