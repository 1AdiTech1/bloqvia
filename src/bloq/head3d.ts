/* Phase 3 (Nov 9, approved in the turnaround mock v4.13): Bloq's head as a thin rounded slab that really turns.
   Facing you (yaw 0) it is exactly today's head: 150 × 148, corners of 38. Turned, you see the face on the front and the
   thin side of the slab (50 deep); in profile only the side; from behind a plain back. The head turns with the body.

   This module draws only the slab, its single crease and the ear lights. Today's face art (eyes, brows, mouths, blush)
   stays as the live SVG group the engine already animates (moods, blink, wide eyes, look); `frontMatrix(yaw)` lays that
   group on the slab's front at the current angle, so every face behaviour keeps working unchanged. */

import { hat3d, COVERS_EARS } from "./hats3d";

export type V3 = [number, number, number];
export type V2 = [number, number];
export type Ears = "light" | null;

const INK = "#1b1622";
const o = `stroke="${INK}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"`;
const o5 = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
const RAD = Math.PI / 180;
/** The camera is a little above him: 100 of depth shows as 5 px of top. */
export const E = 0.05;
const f = (n: number) => n.toFixed(1);
const ss = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Turn a point of a part (x: his right→left as you see him at yaw 0, y down, z toward you) by yaw: view coordinates. */
export function turn(p: V3, yaw: number): V3 {
  const cs = Math.cos(yaw * RAD), sn = Math.sin(yaw * RAD);
  return [p[0] * cs + p[2] * sn, p[1], -p[0] * sn + p[2] * cs];
}
/** The camera: straight on, a little from above, so deeper points move up. zRef is the depth drawn where it is. */
export function proj(p: V3, yaw: number, c: V2, zRef = 0): V2 {
  const [X, Y, Z] = turn(p, yaw);
  return [c[0] + X, c[1] + Y + E * (Z - zRef)];
}
export const facing = (n: V3, yaw: number) => { const [, Y, Z] = turn(n, yaw); return Z - E * Y; };
export const depth = (p: V3, yaw: number) => turn(p, yaw)[2];

function roundRect3(o3: V3, a: V3, b: V3, hu: number, hv: number, r: number, n = 9): V3[] {
  const pts: V3[] = [];
  const corner = (cu: number, cv: number, a0: number) => {
    for (let i = 0; i <= n; i++) {
      const t = (a0 + (90 * i) / n) * RAD, u = cu + r * Math.cos(t), v = cv + r * Math.sin(t);
      pts.push([o3[0] + a[0] * u + b[0] * v, o3[1] + a[1] * u + b[1] * v, o3[2] + a[2] * u + b[2] * v]);
    }
  };
  corner(hu - r, hv - r, 0); corner(-hu + r, hv - r, 90); corner(-hu + r, -hv + r, 180); corner(hu - r, -hv + r, 270);
  return pts;
}
export function hull(points: V2[]): V2[] {
  const p = [...points].sort((A, B) => A[0] - B[0] || A[1] - B[1]);
  const cross = (O: V2, A: V2, B: V2) => (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  const lo: V2[] = [], up: V2[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (up.length >= 2 && cross(up[up.length - 2]!, up[up.length - 1]!, q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
export const poly = (pts: V2[]) => "M" + pts.map((q) => `${f(q[0])} ${f(q[1])}`).join(" L") + " Z";
const bbox = (pts: V2[]) => { const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };

/* ---------- the slab ---------- */
/** The face's centre facing you (x 76..226, y 54..202), in the head group's own coordinates. */
export const HC: V2 = [151, 128];
const HW = 75, HHt = 74, HD = 25;   // half width, half height, half depth
const HR = 38;                      // today's face corners
const RB = 14;                      // the depth edge is rounded (radius 14), so the slab is round from the side
/** The flat face and back lie at ±IZ; the rounded edge runs from there to ±HD. */
export const IZ = HD - RB;

/** The slab as cross-sections through its rounded depth edge. The face keeps its full width and height on every
    section (a flat-fronted pillow): rounding only shortens the slab in depth, so the face's edge is the head's outline
    and never a plate sunk into a bigger block. */
const SLAB = [0, 22.5, 45, 67.5, 90].flatMap((th) => {
  const t = th * RAD, z = IZ + RB * Math.sin(t), shv = RB * (1 - Math.cos(t));
  const hu = HW, hv = HHt - shv, r = Math.max(2, HR - shv), pts: { x: number; y: number; z: number; nx: number }[] = [];
  for (const zz of [z, -z]) for (const [cu, cv, a0] of [[hu - r, hv - r, 0], [-hu + r, hv - r, 90], [-hu + r, -hv + r, 180], [hu - r, -hv + r, 270]] as const)
    for (let i = 0; i <= 8; i++) { const a = (a0 + 11.25 * i) * RAD; pts.push({ x: cu + r * Math.cos(a), y: cv + r * Math.sin(a), z: zz, nx: Math.cos(a) }); }
  return pts;
});

/** Affine matrix that lays the flat face drawing (x 76..226, y 54..202) onto the front of the head at this yaw. */
export function frontMatrix(yaw: number): number[] {
  const cs = Math.cos(yaw * RAD), sn = Math.sin(yaw * RAD);
  // a point (X, Y) of the drawing sits on the face at local (X - 151, Y - 128, +IZ), drawn where depth IZ is
  return [cs, -E * sn, 0, 1, 151 - 151 * cs + IZ * sn, E * (151 * sn + IZ * cs - IZ)];
}
export const mat = (m: number[]) => `matrix(${m.map((x) => x.toFixed(4)).join(" ")})`;
/** How much of the face shows at this yaw (0..1): it fades out between about 73° and 83°. */
export const faceAlpha = (yaw: number) => { const cs = Math.cos(yaw * RAD); return cs > 0 ? ss(0.12, 0.3, cs) : 0; };

/* ---------- the ear lights (Adi's pick, Nov 9): a rectangular lime light set into each side of his head ---------- */
const EAR = { y: 6, z: -2 };
const LIGHT = { hz: 11.5, hy: 21, r: 7 };
function lightSvg(px: number, at: (p: V3) => V2, d = LIGHT) {
  const rr = (hz: number, hy: number, r: number) => poly(roundRect3([px, EAR.y, EAR.z], [0, 0, 1], [0, 1, 0], hz, hy, r).map(at));
  const L = rr(d.hz - 3, d.hy - 3, Math.max(1, d.r - 2.5));
  const h0 = at([px, EAR.y - d.hy + 6.5, EAR.z - d.hz + 5.5]), h1 = at([px, EAR.y - d.hy + 5, EAR.z + d.hz - 6.5]);
  return `<path d="${rr(d.hz + 2.5, d.hy + 2.5, d.r + 2)}" fill="#d4f033" opacity=".55" filter="url(#bq-soft)" class="bq-earglow"/>`
    + `<path d="${rr(d.hz, d.hy, d.r)}" fill="#3b2d63" ${o5}/>`
    + `<path d="${L}" fill="url(#bq-lg)"/>`
    + `<path d="M${f(h0[0])} ${f(h0[1])} L${f(h1[0])} ${f(h1[1])}" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".85"/>`;
}

/**
 * The slab at this yaw, as markup pieces the engine places round its live face group:
 *  under: the whole head (outline fill, the side you see, the face/back panel's fill, the ear light) — drawn first
 *  over:  the head's inked outline, the one crease where the panel meets the side, and the highlights — drawn after
 *         the face art, so the face never paints over the edge
 * faceOn: whether the face (not the back) is toward you; alpha: how much of it shows.
 */
export function headSvg(yaw: number, ears: Ears = null): { under: string; over: string; faceOn: boolean; alpha: number } {
  const at = (p: V3) => proj(p, yaw, HC, IZ);
  const cs = Math.cos(yaw * RAD), sn = Math.sin(yaw * RAD), ac = Math.abs(cs), as = Math.abs(sn);
  const sx = sn > 0 ? -1 : 1;                       // turned right (yaw > 0), his left side (x < 0) faces you
  const fb = cs >= 0 ? 1 : -1;                      // the face or the back
  const onTop = ac >= 0.2;
  const facePts = roundRect3([0, 0, fb * IZ], [1, 0, 0], [0, 1, 0], HW, HHt, HR);
  const sidePts = as > 0.06 ? hull(SLAB.filter((q) => q.nx * sx > 0.3).map((q) => at([q.x, q.y, q.z]))) : [];
  const fill = (d: string, lit: number) => `<path d="${d}" fill="url(#bq-side)"/>` + (lit > 0.01 ? `<path d="${d}" fill="url(#bq-face)" opacity="${lit.toFixed(3)}"/>` : "");
  const fbLit = ss(0.1, 0.3, ac), sideLit = ss(0.8, 0.97, as);
  const fbD = ac > 0.02 ? poly(facePts.map(at)) : "", sideD = sidePts.length ? poly(sidePts) : "", hullD = poly(hull(SLAB.map((q) => at([q.x, q.y, q.z]))));
  const fbFill = fbD ? fill(fbD, fbLit) : "", sideFill = sideD ? fill(sideD, sideLit) : "";
  // the face's (or back's) outline is inked only along the one edge where it meets the thin side you see; its far
  // edge, top and bottom are the head's own silhouette. The edge is picked by where it lands on screen (the one nearer
  // the middle of the head), so it is right whichever way he turns and whether the face or the back shows
  const headX = at([0, 0, 0])[0];
  const edgeX = (e: number) => at([e * HW, 0, fb * IZ])[0];
  const ex = Math.abs(edgeX(1) - headX) < Math.abs(edgeX(-1) - headX) ? 1 : -1;
  const nearK = (q: V3) => q[0] * ex > HW - HR - 0.5;
  const n = facePts.length; let start = 0; while (start < n && nearK(facePts[start]!)) start++;
  const run: V2[] = []; for (let j = 0; j < n; j++) { const k = (start + j) % n; if (nearK(facePts[k]!)) run.push(at(facePts[k]!)); }
  const crease = fbD && run.length > 1 ? `<path d="${"M" + run.map((q) => `${f(q[0])} ${f(q[1])}`).join(" L")}" fill="none" ${o}/>` : "";
  const lightNear = ears === "light" && as > 0.02 ? `<g opacity="${ss(0.2, 0.5, as).toFixed(3)}">${lightSvg(sx * (HW + 0.6), at)}</g>` : "";
  const under = fill(hullD, sideLit) + (onTop ? sideFill + lightNear + fbFill : fbFill + sideFill + lightNear);
  let over = `<path d="${hullD}" fill="none" ${o}/>`;
  // the highlight goes on the face (or back) while it shows clearly, then on the side; it keeps clear of the outline
  const useSide = !onTop || (as > 0.9 && ac < 0.45);
  const best = useSide && sidePts.length ? sidePts : facePts.map(at), bestK = useSide ? sideLit : fbLit;
  const bx0 = bbox(best), k = Math.min(1, (bx0.x1 - bx0.x0) / 150), bx = { ...bx0, x0: bx0.x0 + Math.max(0, 9.5 - 13 * k) };
  over += `<path d="M${f(bx.x0 + 14 * k)} ${f(bx.y0 + 50)} C${f(bx.x0 + 13 * k)} ${f(bx.y0 + 26)} ${f(bx.x0 + 22 * k)} ${f(bx.y0 + 14)} ${f(bx.x0 + 42 * k)} ${f(bx.y0 + 12)}" fill="none" stroke="#fff" stroke-width="${f(3 + 3 * k)}" stroke-linecap="round" opacity="${(0.95 * bestK).toFixed(2)}"/>`;
  const t0 = at([-40, -HHt, -IZ * 0.4]), t1 = at([0, -HHt - 2, -IZ * 0.4]), t2 = at([54, -HHt, -IZ * 0.4]);
  const topW = Math.abs(t2[0] - t0[0]);
  if (topW > 30) over += `<path d="M${f(t0[0])} ${f(t0[1])} Q${f(t1[0])} ${f(t1[1] - 2)} ${f(t2[0])} ${f(t2[1])}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="${(0.8 * ss(30, 70, topW)).toFixed(2)}"/>`;
  over += crease;
  return { under, over, faceOn: fb > 0, alpha: faceAlpha(yaw) };
}

/** The head's silhouette at this yaw (for clipping things that lie over it). */
export function headHull(yaw: number): V2[] { return hull(SLAB.map((q) => proj([q.x, q.y, q.z], yaw, HC, IZ))); }
/** The thin side you see at this yaw (empty near the front and back). */
export function headSide(yaw: number): V2[] {
  const sn = Math.sin(yaw * RAD), sx = sn > 0 ? -1 : 1;
  return Math.abs(sn) > 0.06 ? hull(SLAB.filter((q) => q.nx * sx > 0.3).map((q) => proj([q.x, q.y, q.z], yaw, HC, IZ))) : [];
}
/** A polygon grown by r (for a clip that must keep a stroke). */
export function grown(pts: V2[], r: number): V2[] {
  return hull(pts.flatMap(([x, y]) => [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [x + r * Math.cos((k * Math.PI) / 4), y + r * Math.sin((k * Math.PI) / 4)] as V2)));
}

/** The hat on the head at this yaw: the parts behind the head, the parts in front, and the parts that lie over it. */
export function hatSvg(name: string | null, yaw: number): { back: string; front: string; over: string } {
  return name ? hat3d(name, yaw, E, IZ) : { back: "", front: "", over: "" };
}
export { COVERS_EARS };
export const HAND = `<path d="M-11.5 -5 C-15.5 5 -12 16.5 -3 18 C7 19.2 14 10 13 -2 C11 -10.5 -8.5 -12 -11.5 -5 Z" fill="url(#bq-wg)" ${o5}/>
  <path d="M-4.6 18 C-5.2 14.4 -4.7 11.6 -3.4 9.4 M3.6 18.2 C3.8 14.6 4.4 12 5.6 10.2" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M11.2 -1 C19.5 -3.5 22 7 14.5 11.2 C13 12 11.6 11.6 11 10.6" fill="url(#bq-wg)" ${o5}/>
  <path d="M-7.5 -4.5 C-6 -7.2 -2.8 -8.4 0.6 -8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".95"/>`;
export const GRIP = `<path d="M-12 -6 C-15.5 3 -13.5 11.5 -8.6 14 C-6 15.4 -3.2 14.8 -1.8 13.2 C0 15.6 4.4 15.6 6 13 C8.6 14.8 12.6 13 13.6 8 C15 0 13 -8.6 9 -10.6 C3 -13.4 -9 -12.4 -12 -6 Z" fill="url(#bq-wg)" ${o5}/>
  <path d="M-1.8 13.2 C-2 10.6 -1.6 8.6 -0.8 7.2 M6 13 C6.2 10.8 6.6 9 7.4 7.8" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M8.6 -9.6 C14.6 -12.6 20 -8.6 17.6 -3.2 C16.4 -0.8 13 0 10.4 -1.2" fill="url(#bq-wg)" ${o5}/>
  <path d="M-8 -5.2 C-6.4 -8 -3 -9.2 0.4 -8.8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".95"/>`;
