// @ts-nocheck — drawing engine ported from the approved previews; the typed surface is Bloq.tsx.
/* Phase 2 (Nov 9, approved in the Motion Lab): gravity hops in three sizes, a keyed walk (arms 60%, a "down" after each
   contact, heel-toe roll, the hat bouncing on each step), three cheers that never repeat back to back, sitting down and
   standing up with a body, idle beats, props with weight (lag, a lower arm, two hands for the cube), a surprise take,
   a laugh that shakes, and a wave with a loose wrist. docs/MOTION-RULES.md 8–11. */
/* Motion since Nov 9 (docs/MOTION-RULES.md, approved in the Motion Lab, docs/design/motion-lab/): the rig plays the
   turn (squash-swap, head first, never thinner than 62%), a walk starts with a lean and a dip and stops with a settle,
   steps follow the distance travelled in 2D on the page, and talk(ms, text) moves the mouth with the words (shapes,
   pauses, nods, brows on questions, one gesture a sentence, blinks on full stops). */
/*
 * Bloq rig — the puppet engine behind <Bloq/>. Do not edit by hand: motion changes are tried in the Motion Lab's copy
 * of src/bloq first (docs/design/motion-lab/), approved there, then ported here.
 *
 * Browser-only: nothing here touches window/document until a BloqRig is constructed (SSR-safe import).
 * One shared requestAnimationFrame loop drives every rig on the page; rigs off screen are skipped and the
 * loop stops when no rig is mounted.
 */
import { headSvg, hatSvg, frontMatrix, mat, headHull, headSide, grown, poly, COVERS_EARS, HAND as HAND3, GRIP as GRIP3 } from "./head3d";
import { packSvg, strapSvg, strapSmooth, TORSO } from "./body3d";

/* Phase 3 (Nov 9, approved in docs/design/turnaround v4.13): the head is a thin rounded slab that really turns, with the
   body, through any angle (yaw). Facing you he is today's drawing; turned you see the thin side; in profile a thin
   rectangle without a face; from behind a plain back. The 15 hats turn with it, every part on its own surface. Two lime
   lights in the sides of his head where ears would be (hidden under the headset, the aviator and the helmets). The
   mirror and the fixed side view are gone: facing left is yaw −30, walking is yaw ±90, and a turn is the head leading
   the body through the angles. Every behaviour of Phases 1–2 (moods, blink, talk, gestures, cheers, hops, props,
   sitting, riding) is untouched: only the drawing of the head and hats changed, and the hands are the new ones. */
const engine = (function () {
  const C = { ink: "#1b1622", p: "#8b45d9", pd: "#6630b3", pl: "#b47ff0", l: "#d4f033", ld: "#a6c21a", w: "#ffffff", sh: "#ebe5f6" };
  const { ink: INK, p: P, pd: PD, pl: PL, l: L, ld: LD, w: W, sh: SH } = C;
  const o = `stroke="${INK}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"`;
  const o5 = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
  const RAD = Math.PI / 180;
  let uid = 0;

  /* The head is drawn by head3d.ts (Phase 3): a thin rounded slab that turns. */

  /* Hats are drawn on the head's top and scaled up around the brow line (152,100). */
  const HAT_SCALE = { moto: 1.04, astro: 1.0, tophat: 1.32, aviator: 1.42, agent: 1.12, cap2: 1.3, captain: 1.5, grad: 1.56, bucket: 1.42, surf: 1.42, beanie: 1.32, hardhat: 1.32, detective: 1.32, beret: 1.3, cap: 1.3 };
  // The hats. Their art is the Phase 3 turnaround (hatArt.ts, drawn in 3D by hats3d.ts); this is the list, in the
  // wardrobe's order, for the swap animation's groups and the HATS export.
  const HATS = Object.fromEntries(["cap", "bucket", "beanie", "captain", "hardhat", "beret", "detective", "cap2", "agent", "moto", "astro", "tophat", "aviator", "surf", "grad"].map((k) => [k, true]));

  /* Props sit upright at the front wrist; the object is above the hand. */
  const PROPS = {
    star: `<path d="M0 -70 L8 -52 L28 -50 L13 -37 L18 -17 L0 -28 L-18 -17 L-13 -37 L-28 -50 L-8 -52 Z" fill="${L}" ${o5}/>
          <path d="M0 -70 L0 -40 L28 -50 M0 -40 L18 -17 M0 -40 L-18 -17 M0 -40 L-28 -50" fill="none" stroke="${LD}" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M0 -40 L8 -52 L28 -50 Z M0 -40 L-18 -17 L0 -28 Z" fill="${P}" opacity=".55"/>`,
    chip: `<rect x="-20" y="-66" width="40" height="40" rx="8" fill="${P}" ${o5}/>
          <rect x="-11" y="-57" width="22" height="22" rx="4" fill="${L}" ${o5}/>
          <path d="M-14 -70 v-6 M-4 -70 v-6 M6 -70 v-6 M16 -70 v-6 M-14 -22 v6 M-4 -22 v6 M6 -22 v6 M16 -22 v6" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
          <text x="0" y="-41" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="12" fill="${INK}">AI</text>`,
    thumb: `<path d="M-1 -4 C-3 -12 -1 -24 5 -25 C11 -26 12 -16 10 -6" fill="${W}" ${o5}/>`,
    key: `<rect x="-4" y="-34" width="8" height="30" rx="3" fill="${L}" ${o5}/><path d="M4 -16 h8 M4 -24 h6" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
          <circle cx="0" cy="-46" r="13" fill="${L}" ${o5}/><circle cx="0" cy="-46" r="4.5" fill="${INK}"/>`,
    fuel: `<rect x="-6" y="-70" width="12" height="8" rx="2" fill="${INK}"/><rect x="-15" y="-64" width="30" height="46" rx="7" fill="${L}" ${o5}/>
          <path d="M8 -58 v34" stroke="${LD}" stroke-width="5" stroke-linecap="round"/><path d="M3 -56 L-6 -40 H2 L-3 -26 L8 -44 H0 Z" fill="${INK}"/>`,
    scroll: `<path d="M-19 -62 C-19 -66 -15 -67 -12 -67 L15 -66 C18 -66 20 -63 19 -60 L18 -21 C18 -18 15 -17 12 -17 L-14 -18 C-17 -18 -19 -20 -19 -23 Z" fill="${W}" ${o5}/>
          <path d="M-10 -54 h20 M-10 -45 h14" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity=".5"/>
          <path d="M-9 -34 l6 6 l12 -14" fill="none" stroke="${PD}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
    bulb: `<rect x="-8" y="-28" width="16" height="13" rx="3" fill="#cfd3da" ${o5}/>
          <circle cx="0" cy="-45" r="17" fill="${L}" ${o5}/><path d="M-6 -40 l3 -8 l3 6 l3 -6 l3 8" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
    cube: `<path d="M0 -66 L22 -54 L0 -42 L-22 -54 Z" fill="${PL}" ${o5}/>
          <path d="M-22 -54 L0 -42 L0 -16 L-22 -28 Z" fill="${P}" ${o5}/>
          <path d="M22 -54 L0 -42 L0 -16 L22 -28 Z" fill="${PD}" ${o5}/>`,
    magnifier: `<path d="M2 -6 L12 -30" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
          <circle cx="18" cy="-46" r="17" fill="${W}" fill-opacity=".35" stroke="${INK}" stroke-width="13"/>
          <circle cx="18" cy="-46" r="17" fill="none" stroke="${L}" stroke-width="6"/>`,
    passport: `<rect x="-19" y="-72" width="38" height="52" rx="5" fill="${P}" ${o5}/>
          <circle cx="0" cy="-48" r="10" fill="none" stroke="${L}" stroke-width="3"/><path d="M-10 -48 h20 M0 -58 c-6 6 -6 14 0 20 c6 -6 6 -14 0 -20" fill="none" stroke="${L}" stroke-width="2"/>
          <path d="M-10 -64 h20" stroke="${L}" stroke-width="3" stroke-linecap="round"/>`,
    badge: `<path d="M-8 -34 L-15 -10 L-7 -14 L-3 -6 L2 -30 Z M8 -34 L15 -10 L7 -14 L3 -6 L-2 -30 Z" fill="${P}" ${o5}/>
          <circle cx="0" cy="-46" r="17" fill="${L}" ${o5}/><path d="M0 -56 l3 7 h7 l-5.5 4.5 l2 7 l-6.5 -4 l-6.5 4 l2 -7 l-5.5 -4.5 h7 Z" fill="${INK}"/>`,
    coin: `<circle cx="0" cy="-44" r="18" fill="${L}" ${o5}/><circle cx="0" cy="-44" r="11" fill="none" stroke="${INK}" stroke-width="2.5" opacity=".55"/>
          <g transform="translate(-7.6 -51.2) scale(.35)"><rect x="1" y="29" width="42" height="12" rx="6" fill="${INK}"/><rect x="1" y="15.5" width="36" height="12" rx="6" fill="${INK}" opacity=".78"/><rect x="1" y="2" width="31" height="12" rx="6" fill="${INK}"/></g>`,
  };
  const GLOWS = new Set(["star", "chip", "key", "fuel", "scroll", "bulb", "cube", "magnifier", "passport", "badge", "coin"]);

  /* Pose targets in degrees. 0 = limb hanging down; negative swings forward (toward +x). */
  const POSES = {
    idle:    { s: -14, e: 16, bs: 14, be: -116, hl: 8, hr: -8, kl: 0, kr: 0 },
    thumbs:  { s: -124, e: -36, bs: 14, be: -116, hl: 8, hr: -8, kl: 0, kr: 0 },
    wave:    { s: -125, e: -25, bs: 14, be: -116, hl: 8, hr: -8, kl: 0, kr: 0 },
    point:   { s: -90, e: 2, bs: 14, be: -116, hl: 10, hr: -6, kl: 0, kr: 4 },
    hold:    { s: -96, e: -50, bs: 14, be: -116, hl: 8, hr: -8, kl: 0, kr: 0 },
    present: { s: -58, e: -20, bs: 14, be: -116, hl: 9, hr: -7, kl: 0, kr: 3 },
    cheer:   { s: -132, e: -12, bs: 116, be: 34, hl: 4, hr: -4, kl: 0, kr: 0 },
    walk:    { s: -6, e: 14, bs: 6, be: 14, hl: 0, hr: 0, kl: 0, kr: 0 },
    // sitting on a ledge, facing you: thighs come toward you (drawn short), shins hang down
    sit:     { s: -24, e: 2, bs: 21, be: -6, hl: 58, hr: -58, kl: -52, kr: 52, tl: 0.55 },
    // riding: knees bent, arms out for balance (the loop adds the wobbles)
    ride:    { s: -86, e: -8, bs: 86, be: 8, hl: 22, hr: -22, kl: -30, kr: 30, tl: 0.85 },
    // on the motorbike (side view): thighs forward to the seat, shins back to the pegs, hands on the bars
    bike:    { s: -70, e: 30, bs: -64, be: 28, hl: -70, hr: -66, kl: 80, kr: 74, tl: 1 },
    // zero gravity: reaching forward for the star, legs trailing
    space:   { s: -122, e: -8, bs: 64, be: -30, hl: 26, hr: -8, kl: 34, kr: 44, tl: 1 },
    board:   { s: -42, e: 8, bs: 14, be: -116, hl: 8, hr: -8, kl: 0, kr: 0 },
    boardwave: { s: -42, e: 8, bs: 116, be: 34, hl: 8, hr: -8, kl: 0, kr: 0 },
  };
  const KEYS = ["s", "e", "bs", "be", "hl", "hr", "kl", "kr", "tl"];
  Object.values(POSES).forEach((p) => { if (p.tl == null) p.tl = 1; });

  /* Joint positions for each view. Side view: hips and shoulders close together, back arm behind the body. */
  const RIG = {
    front: { hipL: [141, 286], hipR: [163, 286], shF: [176, 216], shB: [131, 216] },
    side:  { hipL: [147, 286], hipR: [158, 286], shF: [160, 217], shB: [150, 214] },
  };

  const ss_ = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let MIR = 1;   // Phase 3: -1 while the mirrored rig is drawn (he faces left), so the limbs' "forward" flips with him
  const dir = (deg) => [-MIR * Math.sin(deg * RAD), Math.cos(deg * RAD)];
  const add = (p, d, len) => [p[0] + d[0] * len, p[1] + d[1] * len];
  const f = (n) => n.toFixed(1);
  /* A limb as one curve through the joint: no corner at elbow or knee. */
  function limb(a, j, b) {
    const c = [2 * j[0] - (a[0] + b[0]) / 2, 2 * j[1] - (a[1] + b[1]) / 2];
    return `M${f(a[0])} ${f(a[1])} Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`;
  }

  const shoe = `<path d="M-38 19 C-41 3 -24 -9 -6 -8 C9 -7 16 4 14 18 C5 26 -29 27 -38 19 Z" fill="${L}" ${o}/>
      <path d="M-35 16 C-22 21 -2 21 11 16" fill="none" stroke="${LD}" stroke-width="5" stroke-linecap="round"/>
      <path d="M-24 3 C-18 -1 -10 -2 -4 -1" fill="none" stroke="${W}" stroke-width="4" stroke-linecap="round" opacity=".9"/>`;
  const shoeOut = `<g class="v-front">${shoe}</g><g class="v-side"><g transform="scale(-1 1)">${shoe}</g></g>`;
  const hand = HAND3;   // Phase 3: the more detailed open hand (three fingers, a fuller thumb); GRIP3 when he holds the strap

  /* Faces. Smile: corners lifted above the middle of the upper lip, a hint of teeth, a dimple at each corner.
     Laugh: wider and deeper, cheeks push the eyes into happy arcs. */
  const faceFront = `
    <ellipse cx="121" cy="153" rx="11" ry="6.5" fill="#e9b8e6" opacity=".55"/><ellipse cx="191" cy="151" rx="11" ry="6.5" fill="#e9b8e6" opacity=".55"/>
    <g data-r="brows"><path d="M124 101 q10 -6 21 0 M162 99 q11 -7 22 1" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/></g>
    <g data-r="eyes">
      <g class="bq-open">
        <g data-r="eyeL"><ellipse cx="136" cy="126" rx="7.3" ry="11.3" fill="${INK}" transform="rotate(-4 136 126)"/><circle cx="138.5" cy="121" r="2.6" fill="${W}"/></g>
        <g data-r="eyeR"><ellipse cx="172.5" cy="126" rx="7.9" ry="12.2" fill="${INK}" transform="rotate(5 172 126)"/><circle cx="175" cy="120.5" r="2.8" fill="${W}"/></g>
      </g>
      <g class="bq-squint"><path d="M127 130 C131 119 142 119 146 129 M163 129 C167 117 180 117 184 128" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/></g>
    </g>
    <g class="bq-m bq-m-smile">
      <path d="M129 146 C141 154 168 154 181 144 C182 165 169 180 155 180 C140 180 128 165 129 146 Z" fill="${INK}"/>
      <path d="M135 150 C147 157 165 157 176 149 C175 153 174 155 172 156 C161 162 147 162 137 156 C136 154 135 152 135 150 Z" fill="${W}"/>
      <path d="M142 173 C148 165 162 165 167 172 C161 178 148 179 142 173 Z" fill="${L}"/>
      <path d="M125 141 C124 145 125 149 128 151 M185 139 C186 143 185 147 182 149" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
    </g>
    <g class="bq-m bq-m-laugh">
      <path d="M122 140 C138 153 172 153 189 137 C191 168 175 193 156 193 C136 193 119 170 122 140 Z" fill="${INK}"/>
      <path d="M130 146 C146 157 168 157 183 144 C182 149 180 152 177 154 C164 163 146 163 134 155 C132 152 131 149 130 146 Z" fill="${W}"/>
      <path d="M139 183 C147 171 166 171 173 181 C164 190 147 190 139 183 Z" fill="${L}"/>
      <path d="M117 136 C115 141 117 147 121 149 M193 132 C195 137 194 143 190 145" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
    </g>
    <g class="bq-m bq-m-o"><path d="M147 156 C146 148 163 147 164 156 C165 167 159 174 155 174 C150 174 147 166 147 156 Z" fill="${INK}"/></g>
    <g class="bq-m bq-m-talk"><path d="M135 151 C146 157 165 157 176 149 C175 163 166 171 155 171 C144 171 136 163 135 151 Z" fill="${INK}"/><path d="M145 166 C150 161 160 161 164 166 C159 170 150 170 145 166 Z" fill="${L}"/></g>
    <g class="bq-m bq-m-closed"><path d="M134 153 C146 161 165 161 177 151" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/><path d="M129 149 C128 152 129 155 132 157 M182 147 C183 150 182 153 179 155" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/></g>`;
  function svg(id) {
    // the hat groups stay as the targets of the hat-swap animation (.bq-hat on/leaving); the 3D hat is drawn into hatBack/hatOver/hatFront
    const hats = Object.entries(HATS).map(([k]) => `<g class="bq-hat" data-hat="${k}"></g>`).join("");
    const props = Object.entries(PROPS).map(([k, d]) => `<g class="bq-prop" data-prop="${k}">${d}</g>`).join("");
    return premium(`<svg viewBox="0 0 300 400" class="bq" aria-hidden="true" focusable="false">
  <defs><clipPath id="bd${id}"><path d="M250 150 C274 186 276 300 262 372 C258 385 242 385 238 372 C224 300 226 186 250 150 Z"/></clipPath></defs>
  <ellipse class="bq-shadow" cx="152" cy="385" rx="70" ry="10" filter="url(#bq-soft)"/>
  <ellipse class="bq-seat" cx="154" cy="300" rx="52" ry="7" filter="url(#bq-soft)"/>
  <ellipse class="bq-seat" data-r="footShL" rx="20" ry="7" filter="url(#bq-soft)"/>
  <ellipse class="bq-seat" data-r="footShR" rx="20" ry="7" filter="url(#bq-soft)"/>
  <g class="bq-speed"><path d="M128 392 l-4 14 M152 394 l0 16 M176 392 l4 14" stroke="${L}" stroke-width="6" stroke-linecap="round"/></g>
  <g data-r="rideboard" class="bq-rideboard">
    <path d="M70 400 L58 416 L86 402 Z" fill="${INK}"/>
    <path d="M34 392 C38 382 110 381 156 381 C214 381 264 385 278 392 C264 400 214 403 156 403 C110 403 38 402 34 392 Z" fill="url(#bq-pg)" ${o}/>
    <path d="M96 383 L116 383 L104 402 L84 402 Z M196 383 L216 383 L204 402 L184 402 Z" fill="url(#bq-lg)"/>
    <path d="M60 387 C110 384 200 384 250 387" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".55"/>
    <path d="M34 392 C38 382 110 381 156 381 C214 381 264 385 278 392 C264 400 214 403 156 403 C110 403 38 402 34 392 Z" fill="none" ${o}/>
  </g>
  <g class="bq-all">
    <g class="bq-bike">
      <g class="puffs"><circle cx="46" cy="330" r="7"/><circle cx="34" cy="322" r="9"/><circle cx="20" cy="312" r="11"/></g>
      <path d="M70 334 L150 330" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M70 334 L150 330" stroke="#cfd3da" stroke-width="6" stroke-linecap="round"/>
      <g class="wheel" style="transform-origin:88px 352px"><circle cx="88" cy="352" r="32" fill="#2a2338" ${o}/><circle cx="88" cy="352" r="17" fill="url(#bq-lg)" ${o5}/><path d="M88 335 V369 M71 352 H105 M76 340 L100 364 M100 340 L76 364" stroke="${INK}" stroke-width="3"/></g>
      <g class="wheel" style="transform-origin:238px 352px"><circle cx="238" cy="352" r="32" fill="#2a2338" ${o}/><circle cx="238" cy="352" r="17" fill="url(#bq-lg)" ${o5}/><path d="M238 335 V369 M221 352 H255 M226 340 L250 364 M250 340 L226 364" stroke="${INK}" stroke-width="3"/></g>
      <path d="M56 336 C60 312 84 304 110 312" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M56 336 C60 312 84 304 110 312" fill="none" stroke="${PD}" stroke-width="6" stroke-linecap="round"/>
      <path d="M88 352 L132 304 L206 292 M206 292 L238 352" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M88 352 L132 304 L206 292 M206 292 L238 352" fill="none" stroke="${P}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="128" y="306" width="52" height="34" rx="8" fill="#cfd3da" ${o5}/><path d="M138 316 h32 M138 324 h32 M138 332 h32" stroke="${INK}" stroke-width="2.5" opacity=".5"/>
      <path d="M118 300 C128 276 196 268 216 282 L208 308 C182 316 140 316 120 308 Z" fill="${P}" ${o}/>
      <path d="M140 286 C160 278 186 276 202 280" fill="none" stroke="${L}" stroke-width="6" stroke-linecap="round"/>
      <path d="M100 292 C106 282 150 282 160 290 L156 300 L104 300 Z" fill="${INK}"/>
      <path d="M214 298 L226 250" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
      <path d="M216 246 L238 254" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
      <circle cx="244" cy="276" r="11" fill="url(#bq-lg)" ${o5}/>
      <path d="M210 316 C222 306 252 306 266 320" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M210 316 C222 306 252 306 266 320" fill="none" stroke="${PD}" stroke-width="6" stroke-linecap="round"/>
      <path d="M160 336 L184 338" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
    </g>
    <path data-r="legL" fill="none" ${o}/><g data-r="shoeL">${shoeOut}</g>
    <path data-r="legR" fill="none" ${o}/><g data-r="shoeR"><g class="v-front"><g transform="scale(-1 1)">${shoe}</g></g><g class="v-side"><g transform="scale(-1 1)">${shoe}</g></g></g>
    <g data-r="armBBack"></g>
    <g data-r="torso">
      <g data-r="packBack"></g>
      <g data-r="pack"><g class="bq-agentwear"><rect x="98" y="222" width="30" height="20" rx="5" fill="${INK}"/>
          <circle class="bq-led" cx="106" cy="232" r="3.5" fill="${L}"/><circle class="bq-led l2" cx="113" cy="232" r="3.5" fill="${L}"/><circle class="bq-led l3" cx="120" cy="232" r="3.5" fill="${L}"/></g></g>
      <g data-r="torso3">${TORSO}</g>
      <g data-r="strap3"></g>
      <g data-r="packFront"></g>
    </g>
    <g class="bq-board">
      <path d="M250 150 C274 186 276 300 262 372 C258 385 242 385 238 372 C224 300 226 186 250 150 Z" fill="${P}" ${o}/>
      <g clip-path="url(#bd${id})"><path d="M214 214 L292 168 L292 200 L214 246 Z M214 298 L292 252 L292 280 L214 326 Z" fill="${L}"/></g>
      <path d="M250 160 C252 220 252 300 250 376" fill="none" stroke="${INK}" stroke-width="2.5" opacity=".45"/>
      <path d="M241 186 C235 224 235 262 238 300" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".55"/>
      <path d="M250 150 C274 186 276 300 262 372 C258 385 242 385 238 372 C224 300 226 186 250 150 Z" fill="none" ${o}/>
    </g>
    <g data-r="head">
      <g data-r="hatBack"></g>
      <g data-r="headUnder"></g>
      <g data-r="face3">${faceFront}</g>
      <g data-r="headOver"></g>
      <g data-r="hatOver"></g>
      <g data-r="hats">${hats}</g>
      <g data-r="hatFront"></g>
    </g>
    <g data-r="armBFront"><path data-r="armB" fill="none" ${o}/><g data-r="handB">${hand}</g></g>
    <path data-r="armF" fill="none" ${o}/>
    <g data-r="up">
      <circle class="bq-glow" cx="0" cy="-44" r="40" fill="url(#bq-glow)"/>
      <g class="bq-props">${props}</g>
      <g class="bq-shine"><path d="M22 -74 l5 -9"/><path d="M32 -60 l9 -4"/><path d="M8 -82 l1 -10"/></g>
    </g>
    <g data-r="handF"><g class="bq-finger"><path d="M-4 12 C-6 22 -3 31 1 31 C5 31 7 22 4 12" fill="${W}" ${o5}/></g><g data-r="handOpen">${hand}</g><g data-r="handGrip" style="display:none">${GRIP3}</g></g>
  </g>
</svg>`);
  }
  /* The premium layer: soft vertical gradients on every purple, lime and white surface (vinyl-toy look). */
  function premium(m) {
    return m.split(`fill="${P}"`).join('fill="url(#bq-pg)"')
      .split(`fill="${PD}"`).join('fill="url(#bq-pdg)"')
      .split(`fill="${L}"`).join('fill="url(#bq-lg)"')
      .split(`fill="${W}" ${o}`).join(`fill="url(#bq-wg)" ${o}`)
      .split(`fill="${W}" ${o5}`).join(`fill="url(#bq-wg)" ${o5}`);
  }

  function defs() {
    if (document.getElementById("bq-defs")) return;
    const d = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    d.id = "bq-defs"; d.setAttribute("width", "0"); d.setAttribute("height", "0"); d.style.position = "absolute";
    d.innerHTML = `<defs>
      <radialGradient id="bq-glow"><stop offset="0" stop-color="${L}" stop-opacity=".85"/><stop offset=".45" stop-color="${L}" stop-opacity=".35"/><stop offset="1" stop-color="${L}" stop-opacity="0"/></radialGradient>
      <linearGradient id="bq-pg" x1="0" y1="0" x2=".25" y2="1"><stop offset="0" stop-color="#a86df0"/><stop offset=".55" stop-color="#8b45d9"/><stop offset="1" stop-color="#6d33c2"/></linearGradient>
      <linearGradient id="bq-pdg" x1="0" y1="0" x2=".25" y2="1"><stop offset="0" stop-color="#7d42cc"/><stop offset="1" stop-color="#4e2392"/></linearGradient>
      <linearGradient id="bq-lg" x1="0" y1="0" x2=".2" y2="1"><stop offset="0" stop-color="#ebfb7a"/><stop offset=".55" stop-color="#d4f033"/><stop offset="1" stop-color="#b3cd1c"/></linearGradient>
      <linearGradient id="bq-wg" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ece6f7"/></linearGradient>
      <linearGradient id="bq-face" x1=".15" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".62" stop-color="#faf8fe"/><stop offset="1" stop-color="#e3d9f4"/></linearGradient>
      <linearGradient id="bq-side" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7f3fe"/><stop offset=".5" stop-color="#ddd2f1"/><stop offset="1" stop-color="#b3a3d8"/></linearGradient>
      <filter id="bq-soft" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="3.5"/></filter>
    </defs>`;
    document.body.prepend(d);
  }

  const rigs = new Set();
  // follow gait (walking(true, true)): stride per cycle in body widths, and the speeds (body widths a second) where the run starts and is full
  const STRIDE_WALK = 0.52, STRIDE_RUN = 0.8, RUN_FROM = 1.2, RUN_FULL = 2.0;
  // hops on the spot, with one gravity for all three: crouch c, flight f (a parabola h units high), landing l (s)
  const HOPS = {
    small: { c: 0.09, f: 0.3, l: 0.13, h: 40, sq: 0.12 },
    happy: { c: 0.12, f: 0.42, l: 0.18, h: 80, sq: 0.16 },
    big:   { c: 0.16, f: 0.54, l: 0.25, h: 130, sq: 0.18, tuck: true },
  };
  Object.values(HOPS).forEach((h) => (h.total = h.c + h.f + h.l));
  // how heavy each prop is: 0 light (follows the hand), 1 medium (lower, lags), 2 heavy (two hands)
  const PROP_W = { key: 0, coin: 0, bulb: 0, star: 0, chip: 0, thumb: 0, badge: 0, magnifier: 0, scroll: 1, passport: 1, fuel: 1, cube: 2 };
  /** angles (this rig's convention) for a two-bone arm from S reaching P; bend = +1 or -1 picks the elbow side. */
  function ik(S, P, l1, l2, bend) {
    const dx = P[0] - S[0], dy = P[1] - S[1], d = Math.max(1, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.5)), base = Math.atan2(-dx, dy) / RAD;
    const A = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))) / RAD;
    const B = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2)))) / RAD;
    return [base + bend * A, -bend * (180 - B)];
  }
  const still = () => document.body.classList.contains("still") || matchMedia("(prefers-reduced-motion: reduce)").matches;
  let headShape = "block";

  /* A talking plan from the text. The line is spread over its duration by weight (letters 1, spaces .55,
     commas 2.4, full stops 4); each letter picks a mouth (a: open, e/i/y/f/v: wide with teeth, o/u/w: round,
     m/b/p: closed, others keep the last open shape); shapes shorter than 70 ms merge into the one before; the
     mouth closes on every pause. Stressed words (a sentence's first word, words of 7+ letters, words before "!")
     get a nod; a question lifts the brows for its sentence; each sentence gets one hand gesture; a blink lands
     on each full stop. */
  function talkPlan(text, dur) {
    const W = (c) => (/[.!?…]/.test(c) ? 4 : /[,;:—–]/.test(c) ? 2.4 : c === " " ? 0.55 : /[\p{L}\p{N}]/u.test(c) ? 1 : 0.3);
    const chars = Array.from(text), tot = chars.reduce((n, c) => n + W(c), 0) || 1, per = dur / tot;
    const tAt = []; let tc = 0; chars.forEach((c, k) => { tAt[k] = tc; tc += W(c) * per; }); tAt[chars.length] = tc;
    // mouth: a new shape starts at each vowel (and at m/b/p, f/v and pauses); other letters keep the shape
    const raw = []; let cur = { t0: 0, m: "closed" };
    chars.forEach((c, k) => {
      const lc = c.toLowerCase();
      let m = null;
      if (/[.!?…,;:—–]/.test(c)) m = "pause";
      else if (lc === "a") m = "talk";
      else if (/[eiyăâîfv]/.test(lc)) m = "smile";
      else if (/[ouw]/.test(lc)) m = "o";
      else if (/[mbp]/.test(lc)) m = "closed";
      if (m && (m !== cur.m || m === "pause")) { cur.t1 = tAt[k]; raw.push(cur); cur = { t0: tAt[k], m }; }
    });
    cur.t1 = tc; raw.push(cur);
    const segs = [];
    raw.forEach((r) => {
      const m = r.m === "pause" ? "closed" : r.m, p = segs[segs.length - 1];
      if (r.t1 - r.t0 <= 0) return;
      if (p && p.m === m) p.t1 = r.t1;
      else if (p && r.t1 - r.t0 < 0.07 && r.m !== "pause") p.t1 = r.t1;   // too short to read: the shape before holds
      else segs.push({ t0: r.t0, t1: r.t1, m });
    });
    // words, sentences, stresses
    const nods = [], qs = [], gests = [], blinks = [], words = [];
    let sStart = 0, sFirst = true, sGest = false, wordStart = -1, word = "";
    const endWord = (k) => {
      if (wordStart < 0) return;
      words.push({ t: tAt[wordStart], w: word });
      const bang = chars[k] === "!", stressed = sFirst || word.length >= 7 || bang;
      if (stressed && nods.length && tAt[wordStart] - nods[nods.length - 1].t < 0.3) nods[nods.length - 1].a = 1; // two close stresses: one firmer nod
      else if (stressed) { nods.push({ t: tAt[wordStart], a: sFirst ? 0.7 : 1 }); if (!sGest && (!sFirst || word.length >= 5)) { gests.push({ t: tAt[wordStart] }); sGest = true; } }
      sFirst = false; wordStart = -1; word = "";
    };
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (/[\p{L}\p{N}'’]/u.test(c)) { if (wordStart < 0) wordStart = i; word += c; continue; }
      endWord(i);
      if (/[.!?…]/.test(c)) {
        if (c === "?") qs.push({ t0: tAt[sStart], t1: tAt[i + 1] });
        if (c === ".") blinks.push(tAt[i] + 0.04);
        sStart = i + 1; sFirst = true; sGest = false;
      }
    }
    endWord(chars.length);
    return { segs, nods, qs, gests, blinks, words, dur, bi: 0 };
  }
  /** The nearest box around el that scrolls vertically (as camera.ts), or null for the page. */
  function scrollBoxOf(el) {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight + 1) return p;
    }
    return null;
  }
  const pulse = (u) => (u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0);
  const ease = (x) => x * x * (3 - 2 * x);

  class Bloq {
    constructor(host, opts = {}) {
      defs();
      this.id = ++uid;
      this.host = host;
      host.classList.add("bq-host");
      host.innerHTML = `<div class="bq-flip">${svg(this.id)}</div>`;
      this.flip = host.firstElementChild;
      this.el = this.flip.firstElementChild;
      this.r = {};
      this.el.querySelectorAll("[data-r]").forEach((n) => (this.r[n.dataset.r] = n));
      this.all = this.el.querySelector(".bq-all");
      this.cur = {}; this.vel = {};
      KEYS.forEach((k) => { this.cur[k] = POSES.idle[k]; this.vel[k] = 0; });
      this.look_ = { x: 0, y: 0, tx: 0, ty: 0 };
      this.hatLag = { a: 0, v: 0, y: 0, vy: 0 };
      this.brow = { y: 0, ty: 0 };
      this.t = Math.random() * 10; this.walkPhase = 0; this.blinkAt = 1 + Math.random() * 3; this.blink = 0;
      this.jumpT = -1; this.turnT = -1; this.sitT = -1; this.view = "front";
      this.faceT = -1; this.startT = -1; this.stopT = -1; this.amp = 0; this.talkPlan_ = null; this.talkT = 0; this._box = null;
      // Phase 2 state
      this.hop = null; this._cheerV = null; this._cheerT = 0; this.standT = -1; this.takeT = -1; this._handLag = 0; this._two = 0;
      this.idle = { next: 4 + Math.random() * 4, beat: null, last: null, for: 0 };
      this.pl = { a: 0, v: 0, y: 0, yv: 0, lx: null, ly: null };
      this.hat = null; this.prop = null;
      // Phase 3: the angle he faces (yaw, degrees: 0 toward you, +90 his right side toward you = facing right, 180 away).
      // The body follows a spring toward yawTarget; the head leads it by HEAD_LEAD seconds.
      this.yaw = 30; this.yawV = 0; this.yawTarget = 30; this.headYaw = 30; this._yawHist = [];
      this.ears = opts.ears === undefined ? "light" : opts.ears;
      this.setHat(opts.hat || "cap", false);
      this.setProp(opts.prop || null, false);
      this.setPose(opts.pose || "idle", true);
      this.setMood("smile");
      this.setHead(opts.head || headShape);
      this.setOutfit(opts.outfit || null);
      this.talkLeft = 0;
      this.face(opts.face || "right");
      this.visible = true;
      if ("IntersectionObserver" in window) { this._io = new IntersectionObserver((es) => (this.visible = es[0].isIntersecting), { rootMargin: "120px" }); this._io.observe(host); }
      rigs.add(this);
      ensureLoop();
      this._draw(0);
    }
    setPose(p, snap = false) {
      if (!POSES[p]) p = "idle";
      if (p !== "walk" && p !== "idle") this._skipStride();
      // a cheer never twice the same in a row; leaving a seat plays the stand-up
      if (p === "cheer" && this.pose !== "cheer") { const vs = ["v", "pump", "shimmy"].filter((x) => x !== this._cheerV); this._cheerV = vs[Math.floor(Math.random() * vs.length)]; this._cheerT = 0; }
      if (this.pose === "sit" && p !== "sit" && !snap && !still()) this.standT = 0;
      this.pose = p; this.target = POSES[p];
      // walking with something in hand: the elbow bends and holds it up in front of him (both hands for the cube),
      // so the arm never hangs through it; the springs carry him smoothly from holding to carrying and back
      if (p === "walk" && this.prop) this.target = { ...POSES.walk, s: -26, e: -81, ...((PROP_W[this.prop] ?? 0) === 2 ? { bs: -26, be: -81 } : {}) };
      this.el.classList.toggle("pointing", p === "point");
      if (p === "sit" && !this.el.classList.contains("sitting") && !still()) this.sitT = 0;
      this.el.classList.toggle("sitting", p === "sit");
      this.el.classList.toggle("riding", p === "ride");
      this.el.classList.toggle("biking", p === "bike");
      this.el.classList.toggle("spacing", p === "space");
      if (p === "bike") { this.setView("side"); this._aimYaw(); }
      else if (!this.isWalking && this.view === "side") this.setView("front");
      if (snap || still()) KEYS.forEach((k) => { this.cur[k] = this.target[k]; this.vel[k] = 0; });
      return this;
    }
    setMood(m, ms) {
      clearTimeout(this._moodT);
      if (m === "o" && this.el.dataset.mood !== "o" && !still()) this.takeT = 0; // the surprise take
      this.el.dataset.mood = m;
      this.brow.ty = m === "o" ? -7 : m === "laugh" ? -4 : 0;
      if (ms) this._moodT = setTimeout(() => this.setMood("smile"), ms);
      return this;
    }
    setHat(h, animate = true) {
      if (h === this.hat) return this;
      const q = (k) => this.el.querySelector(`.bq-hat[data-hat="${k}"]`);
      const old = this.hat && q(this.hat), nu = q(h);
      this.hat = h;
      this.el.querySelectorAll(".bq-hat").forEach((g) => g.classList.toggle("on", g === nu));
      if (animate && !still()) {
        this.setMood("o", 560);
        if (old) {
          old.classList.add("leaving");
          old.animate([{ transform: "translate(0,0) rotate(0)", opacity: 1 }, { transform: "translate(-44px,-130px) rotate(-40deg)", opacity: 0 }], { duration: 380, easing: "cubic-bezier(.4,0,.8,.4)" })
            .onfinish = () => old.classList.remove("leaving");
        }
        nu.animate([{ transform: "translate(0,-150px) rotate(16deg)", opacity: 0 }, { transform: "translate(0,-150px) rotate(16deg)", opacity: 1, offset: 0.3 }, { transform: "translate(0,7px) rotate(-4deg)", offset: 0.78 }, { transform: "translate(0,0) rotate(0)" }],
          { duration: 680, easing: "cubic-bezier(.3,.7,.4,1)" });
        this.hatLag.vy -= 3;
      }
      return this;
    }
    setProp(p, animate = true) {
      if (p === this.prop) return this;
      this.prop = p;
      this.el.querySelectorAll(".bq-prop").forEach((g) => g.classList.toggle("on", g.dataset.prop === p));
      this.el.classList.toggle("has-glow", GLOWS.has(p));
      const nu = p && this.el.querySelector(`.bq-prop[data-prop="${p}"]`);
      if (nu && animate && !still()) nu.animate([{ transform: "scale(0) rotate(-30deg)" }, { transform: "scale(1.22) rotate(8deg)", offset: 0.6 }, { transform: "scale(1) rotate(0)" }], { duration: 480, easing: "ease-out" });
      return this;
    }
    /** Front view or side view (head, body and backpack turn together). */
    setView(v) {
      if (v === this.view) return this;
      this.view = v;
      this.el.classList.toggle("side", v === "side");
      this._aimYaw();
      if (!still()) this.turnT = 0;
      return this;
    }
    /* The mirror flips at once (no CSS transition) and the rig plays the turn: from the old side, a small dip,
       squash to 62% (never thinner), swap at the squash, the head 40 ms ahead of the body, out with a 5% overshoot,
       knees stepping round, the hat swinging after. 300 ms. */
    /* Facing right is his everyday view turned 30° to the right (yaw 30); facing left is the same to the left (−30).
       Walking turns him to the side (±90). No mirror: he really turns, the head 45 ms ahead of the body. */
    face(d) {
      const was = this.facing;
      this.facing = d;
      this._aimYaw();
      if (was && was !== d && !still()) { this.faceT = 0; this.hatLag.v += 170 * (d === "left" ? -1 : 1); }
      return this;
    }
    /** The yaw he should be at for his facing and view (walking shows the side). */
    _aimYaw() {
      // in the model a positive yaw turns him toward your right (today's "facing right" drawing is yaw 30), so facing
      // right is positive and facing left negative. Walking in profile is 90°; a walk that follows the ground (the map
      // road, the cards: walking(true, true)) keeps his face toward you at a 3/4 angle (55°), so you see him on the way
      const sgn = this.facing === "left" ? -1 : 1;
      this.yawTarget = this.view === "side" ? (this.pose === "bike" ? 62 : this.isWalking && this.follow ? 55 : 90) * sgn : 30 * sgn;
      if (still()) { this.yaw = this.headYaw = this.yawTarget; this.yawV = 0; }
    }
    look(dx, dy) { this.look_.tx = dx * (this.facing === "left" ? -1 : 1); this.look_.ty = dy; return this; }
    /* Starting: a lean back and a dip in the front view (90 ms), the turn to the side at the dip, then the
       stride grows from nothing while he leans into it (overshoot, 170 ms). Stopping: the stride dies out over
       200 ms, the front view comes back with a squash, he rocks back and his knees soak up the stop (200 ms).
       A page that moves on at once (a new pose like sit or cheer, a jump, pointing) skips to the front view and the
       settle, so it never waits on the stride. */
    walking(on, follow = false) {
      if (on) {
        this.follow = !!follow; this._lx = null; this._ly = null; this.gv = 0; this.run = 0;
        this._box = this.follow ? scrollBoxOf(this.host) : null;
        const starting = !this.isWalking;
        this.isWalking = true; this.stopT = -1;
        if (starting) {
          if (still()) { this.amp = 1; this.setView("side"); }
          else { this.startT = 0; this.amp = 0; this.walkPhase = 0; }
        } else if (this.view !== "side") this.setView("side");
        this.setPose("walk"); this._aimYaw();
      } else if (this.isWalking) {
        this.startT = -1;
        if (still()) { this.isWalking = false; this.amp = 0; this.setView("front"); }
        else if (this.stopT < 0) this.stopT = 0;
      }
      return this;
    }
    /** While stopping: go straight to the front view and the settle (the page has moved on). */
    _skipStride() {
      if (this.stopT >= 0 && this.stopT < 0.5) { this.stopT = 0.5; this.amp = 0; this.setView("front"); this.hatLag.v += 140; }
    }
    /** a hop on the spot with gravity. "small" keeps his pose (a tap, an arrival), "happy" (the default) cheers,
        "big" is a celebration with a tuck. */
    jump(kind = "happy") {
      if (still()) return this;
      this._skipStride();
      const K = HOPS[kind] || HOPS.happy;
      if (kind !== "small") {
        if (this.jumpT < 0) this._before = this.pose === "cheer" ? "idle" : this.pose;
        this.setPose(this.outfit === "surf" ? "boardwave" : "cheer").setMood("laugh", Math.round(K.total * 1000) + 350);
      } else this.setMood("laugh", 600);
      this.hop = { k: K, kind: HOPS[kind] ? kind : "happy" };
      this.jumpT = 0;
      return this;
    }
    /** Unmount: stop drawing, drop timers and observers, empty the host. */
    destroy() {
      rigs.delete(this); this._io?.disconnect();
      clearTimeout(this._moodT); clearTimeout(this._jumpT);
      this.host.innerHTML = ""; this.host.classList.remove("bq-host");
    }
    setHead(shape) { this.headShape = shape; this.el.classList.toggle("h-round", shape === "round"); return this; }
    /** "surf": board shorts and a surfboard at his side. */
    setOutfit(o) { this.outfit = o; this.el.classList.toggle("outfit-surf", o === "surf"); this.el.classList.toggle("outfit-agent", o === "agent"); this.el.classList.toggle("outfit-astro", o === "astro"); return this; }
    /** Point the front arm at an element and keep aiming while it moves (layout changes, scroll). null stops. */
    /** Point the front arm at an element and keep aiming while it moves (layout changes, scroll). null stops. */
    aimAt(el) { this.aimEl = el; if (el) this.setPose("point"); return this; }
    _aim() {
      const el = this.aimEl; if (!el || !el.isConnected) return;
      const m = this.el.getScreenCTM(); if (!m) return;
      const r = el.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
      const me = this.el.getBoundingClientRect();
      const want = tx < me.left + me.width / 2 ? "left" : "right";
      if (want !== this.facing) { this.face(want); return; } // turn first, aim next frame
      const pt = new DOMPoint(tx, ty).matrixTransform(m.inverse());
      // Phase 3: the front shoulder is where the rig puts it at his angle (mirrored when he faces left); the arm's
      // angle is in the rig's own convention, where dir(ang) is mirrored too
      const mir = this._mir || 1, sh = [152 + mir * (RIG.front.shF[0] - 152), RIG.front.shF[1]], vx = (pt.x - sh[0]) * mir, vy = pt.y - sh[1];
      const ang = Math.atan2(-vx, vy) / RAD;   // dir(ang) points from the shoulder at the target
      this.target = { ...POSES.point, s: Math.max(-170, Math.min(-10, ang)), e: 0 };
      this.look_.tx = 0.6; this.look_.ty = Math.max(-1, Math.min(1, vy / 200));
    }
    /** While riding: start losing balance now. */
    wobble() { if (this.ride && this.ride.ev < 0) this.ride.next = 0; return this; }
    /** While riding: wave with the front arm (true/false). */
    rideWave(on) { this.rideWaving = on; return this; }
    /** Lip-flap for ms milliseconds, then back to a smile. */
    /** With the text, the mouth follows the words (talkPlan); without it, the lip flap of before. */
    talk(ms = 2400, text) { this.talkLeft = ms / 1000; this.talkT = 0; this.talkPlan_ = text ? talkPlan(text, ms / 1000) : null; return this; }

    _step(dt) {
      if (this.aimEl) this._aim();
      const k = 150, c = 15; // a little underdamped: moves overshoot and settle
      KEYS.forEach((key) => {
        const a = k * (this.target[key] - this.cur[key]) - c * this.vel[key];
        this.vel[key] += a * dt; this.cur[key] += this.vel[key] * dt;
      });
      // the turn: the body's yaw springs to its target (critically damped, ~300 ms); the head is where the body was
      // 45 ms ago, played ahead (it leads into the turn and settles first)
      { const k = 110, c = 2 * Math.sqrt(k) * 0.78, acc = k * (this.yawTarget - this.yaw) - c * this.yawV; this.yawV += acc * dt; this.yaw += this.yawV * dt;
        this._yawHist.push({ t: this.t + dt, y: this.yaw }); while (this._yawHist.length > 2 && this._yawHist[1].t < this.t + dt - 0.045) this._yawHist.shift();
        const h = this._yawHist[0]; const lead = this.yaw + (this.yaw - h.y) * 1.0;   // ahead by as much as it moved in the last 45 ms
        this.headYaw = Math.abs(this.yawTarget - this.yaw) < 0.05 ? this.yaw : lead; }
      const L_ = this.look_;
      L_.x += (L_.tx - L_.x) * Math.min(1, dt * 8); L_.y += (L_.ty - L_.y) * Math.min(1, dt * 8);
      this.brow.y += (this.brow.ty - this.brow.y) * Math.min(1, dt * 12);
      this.blinkAt -= dt;
      if (this.blinkAt <= 0) { this.blink = 0.14; this.blinkAt = 2.2 + Math.random() * 3.4; if (Math.random() < 0.22) this.blinkAt = 0.32; }
      this.blink = Math.max(0, this.blink - dt);
      if (this.jumpT >= 0) { this.jumpT += dt / (this.hop ? this.hop.k.total : 0.78); if (this.jumpT >= 1) { this.jumpT = -1; if (!this.hop || this.hop.kind !== "small") this.setPose(this._before || "idle"); } }
      // Phase 2 timers
      this._cheerT += dt;
      if (this.standT >= 0) { this.standT += dt / 0.45; if (this.standT >= 1) this.standT = -1; }
      if (this.takeT >= 0) { this.takeT += dt / 0.5; if (this.takeT >= 1) this.takeT = -1; }
      // idle beats: every 4–8 s something small (a weight shift, a glance); after 10 s also a bigger one (the hat, a stretch)
      const I = this.idle;
      const calm = (this.pose === "idle" || this.pose === "hold") && !this.isWalking && this.jumpT < 0 && this.faceT < 0 && this.talkLeft <= 0 && !this.aimEl && !this.el.classList.contains("floaty");
      if (calm) {
        I.for += dt;
        if (I.beat) {
          I.beat.t += dt / I.beat.d;
          if (I.beat.kind === "glance") this.look_.tx = I.beat.t > 0.12 && I.beat.t < 0.72 ? I.beat.dir * 0.9 : I.beat.tx0;
          if (I.beat.t >= 1) { if (I.beat.kind === "glance") this.look_.tx = I.beat.tx0; I.beat = null; I.next = 4 + Math.random() * 4; }
        } else if ((I.next -= dt) <= 0) {
          const pool = ["shift", "glance"]; if (I.for > 10 && this.pose === "idle") pool.push("hat", "stretch");
          const ks = pool.filter((x) => x !== I.last), kind = ks[Math.floor(Math.random() * ks.length)];
          I.beat = { kind, t: 0, d: { shift: 1.3, glance: 1.5, hat: 1.7, stretch: 1.5 }[kind], dir: Math.random() < 0.5 ? -1 : 1, tx0: this.look_.tx };
          I.last = kind; if (kind === "hat" || kind === "stretch") I.for = 0;
        }
      } else {
        if (I.beat) { if (I.beat.kind === "glance") this.look_.tx = I.beat.tx0; I.beat = null; }
        I.for = 0; I.next = Math.max(I.next, 2.5);
      }
      if (this.turnT >= 0) { this.turnT += dt / 0.22; if (this.turnT >= 1) this.turnT = -1; }
      // turn, start and stop of a walk
      if (this.faceT >= 0) { this.faceT += dt / 0.3; if (this.faceT >= 1) this.faceT = -1; }
      if (this.startT >= 0) {
        const was = this.startT; this.startT += dt / 0.26;
        if (was < 0.35 && this.startT >= 0.35) { this.setView("side"); this.hatLag.v -= 120; }
        if (this.startT >= 1) this.startT = -1;
      }
      if (this.stopT >= 0) {
        const was = this.stopT; this.stopT += dt / 0.4;
        if (was < 0.5 && this.stopT >= 0.5) { this.setView("front"); this.hatLag.v += 140; this.hatLag.vy += 1; }
        if (this.stopT >= 1) { this.stopT = -1; this.isWalking = false; }
      }
      if (this.sitT >= 0) { this.sitT += dt / 0.65; if (this.sitT >= 1) this.sitT = -1; } // .65 s: get ready, land, settle
      if (this.talkLeft > 0) {
        this.talkLeft -= dt;
        const P = this.talkPlan_;
        let m;
        if (P) {
          this.talkT += dt;
          const tt = this.talkT, seg = P.segs.find((s_) => tt >= s_.t0 && tt < s_.t1);
          m = this.talkLeft > 0 ? (seg ? seg.m : "closed") : "smile";
          if (P.bi < P.blinks.length && tt >= P.blinks[P.bi]) { this.blink = 0.14; P.bi++; }
          const q = P.qs.some((r_) => tt >= r_.t0 && tt < r_.t1);
          if (this.el.dataset.mood !== "o" && this.el.dataset.mood !== "laugh") this.brow.ty = q && this.talkLeft > 0 ? -6 : 0;
        } else m = this.talkLeft > 0 && Math.sin(this.t * 26) > -0.2 ? "talk" : "smile";
        if (this.el.dataset.mood !== m && this.el.dataset.mood !== "laugh") this.el.dataset.mood = m;
        if (this.talkLeft <= 0) this.talkPlan_ = null;
      }
    }

    _draw(dt) {
      const live = !still();
      if (live) this._step(dt); else {
        KEYS.forEach((key) => (this.cur[key] = this.target[key])); this.blink = 0; this.jumpT = -1; this.turnT = -1;
        // motion off ends every sequence at its last frame
        this.faceT = -1;
        if (this.startT >= 0) { this.startT = -1; this.setView("side"); }
        if (this.stopT >= 0) { this.stopT = -1; this.isWalking = false; this.setView("front"); }
        this.amp = this.isWalking ? 1 : 0;
        this.standT = -1; this.takeT = -1; this.idle.beat = null; this.pl.a = 0; this.pl.y = 0;
        this._aimYaw();
      }
      this.t += dt;
      const t = this.t, a = { ...this.cur }, r = this.r, side = this.view === "side";
      // joints: blend from the front rig to the side rig by how far he has turned; a yaw to the left mirrors x about 152
      const yawB = this.yaw, ys = Math.abs(Math.sin(yawB * RAD)), kSide = ss_(0.5, 1, ys), mir = Math.sin(yawB * RAD) >= 0 ? 1 : -1;
      // the rig's "front" shoulder is on your right in its drawing; when the mirrored rig is used, the hands' thumbs go the other way
      this._mir = mir; MIR = mir;
      const jm = (p) => [152 + mir * (p[0] - 152), p[1]];
      const J = {}; for (const k of ["hipL", "hipR", "shF", "shB"]) { const F = RIG.front[k], S = RIG.side[k]; J[k] = jm([F[0] + (S[0] - F[0]) * kSide, F[1] + (S[1] - F[1]) * kSide]); }
      const floaty = this.el.classList.contains("floaty");

      let bodyY = 0, lean = 0, breath = live ? Math.sin(t * 1.8) * 0.018 : 0, headTilt = live ? Math.sin(t * 1.15) * 2.4 : 0;
      // the stride's size (0..1): grows after the start's dip, dies out at the stop
      this._rollL = 0; this._rollR = 0;
      if (this.isWalking && live) {
        if (this.startT >= 0) this.amp = this.startT < 0.35 ? 0 : 1 - Math.pow(1 - (this.startT - 0.35) / 0.65, 3);
        else if (this.stopT >= 0) this.amp = this.stopT < 0.5 ? 1 - ease(this.stopT / 0.5) : 0;
        else this.amp = 1;
      }
      if (this.isWalking && live) {
        let run = 0;
        if (this.follow) {
          // walking(true, true): the steps follow the ground. The phase moves with the distance the host really
          // travels, so his feet never slide, and fast trips blend into a run (longer stride, knees up, elbows folded forward,
          // more bounce, leaning in). STRIDE_* are body widths per full cycle (two steps).
          // distance in 2D (a road goes down the screen too), measured on the page, not the screen, so the camera
          // scrolling the page (or the scrolling box he walks in) doesn't count as steps
          const rc = this.host.getBoundingClientRect(), bx = this._box;
          const x = rc.left + scrollX + (bx ? bx.scrollLeft : 0), y = rc.top + scrollY + (bx ? bx.scrollTop : 0), wpx = this.host.offsetWidth || 100;
          const dx = this._lx == null ? 0 : Math.hypot(x - this._lx, y - this._ly); this._lx = x; this._ly = y;
          const v = dt > 0 ? dx / wpx / dt : 0;
          this.gv += (v - this.gv) * Math.min(1, dt * 8);
          this.run += (Math.max(0, Math.min(1, (this.gv - RUN_FROM) / (RUN_FULL - RUN_FROM))) - this.run) * Math.min(1, dt * 5);
          run = this.run;
          this.walkPhase += (dx / wpx / (STRIDE_WALK + (STRIDE_RUN - STRIDE_WALK) * run)) * Math.PI * 2;
        } else this.walkPhase += dt * (Math.PI * 2 / 0.62);
        const ph = this.walkPhase, s = Math.sin(ph), cph = Math.cos(ph), k = (1 + 0.45 * run) * this.amp, am = this.amp;
        a.hl += -26 * k * s; a.hr += 26 * k * s;
        // a keyed walk. The swinging leg folds through the passing pose; the leg that just landed gives a little
        // ("down", just after each contact); arms swing 60% of the legs, a moment late; the body drops fast after each
        // contact and rises slowly to the passing pose; the head follows late; heel first, toe off; the hat bounces.
        const down = Math.pow(Math.max(0, -Math.cos(2 * ph - 0.6)), 2);
        a.kl += (36 + 44 * run) * am * Math.max(0, cph) + 10 * am * down * (s > 0 ? 1 : 0);
        a.kr += (36 + 44 * run) * am * Math.max(0, -cph) + 10 * am * down * (s < 0 ? 1 : 0);
        const sa = Math.sin(ph - 0.3);
        // the elbow folds FORWARD (negative in this rig): a little on the arm's front swing when walking, a lot in the
        // run, so the hands pump in front at waist height (Nov 12; before, +46 folded the forearms back behind the hips)
        a.s += (16 + 10 * run) * k * sa; a.e += -(12 * Math.max(0, -sa) + 64 * run) * am;
        a.bs += -(16 + 10 * run) * k * sa; a.be += -(12 * Math.max(0, sa) + 64 * run) * am;
        // carrying something (the carry pose, set in setPose): the arm that holds it swings only 30%
        if (this.prop) { a.s += -0.7 * 16 * k * sa; if ((PROP_W[this.prop] ?? 0) === 2) a.bs += 0.7 * 16 * k * sa; }
        bodyY = -6 * (1 + 0.9 * run) * Math.pow(Math.abs(Math.cos(ph - 0.25)), 1.6) * am + 2.2 * down * am;
        lean = (-5 - 7 * run) * am; headTilt += 2.4 * Math.sin(ph * 2 - 0.9) * am;
        this._rollL = am * (-14 * Math.pow(Math.max(0, s), 6) + 16 * Math.pow(Math.max(0, -s), 4));
        this._rollR = am * (-14 * Math.pow(Math.max(0, -s), 6) + 16 * Math.pow(Math.max(0, s), 4));
        const step = Math.floor((ph - Math.PI / 2) / Math.PI);
        if (step !== this._step_) { if (this._step_ != null) this.hatLag.vy += 0.7 * am; this._step_ = step; }
        // start: lean back and dip, then push into the first step; stop: rock back and soak it up
        if (this.startT >= 0) {
          const q = this.startT;
          if (q < 0.35) { const e = q / 0.35; lean += 4 * pulse(e); bodyY += 4 * pulse(e); a.kl += 14 * pulse(e); a.kr += 14 * pulse(e); a.s -= 10 * pulse(e); a.bs += 10 * pulse(e); }
          else lean -= 6 * pulse((q - 0.35) / 0.65);
        }
        if (this.stopT >= 0) {
          const q = this.stopT;
          lean += 4.5 * pulse((q - 0.3) / 0.7) * (q > 0.3 ? 1 : 0);
          const d = pulse((q - 0.45) / 0.55); bodyY += 4 * d; a.kl += 16 * d; a.kr += 16 * d;
          a.s += 8 * pulse(q); a.bs -= 8 * pulse(q);
        }
        // the lean is a rotation of the torso on the page, so it has to follow the mirror like the limbs do: without
        // this he leaned into a walk to the right and away from a walk to the left (Nov 12)
        lean *= mir;
      }
      // the wave: the shoulder joins in, the hand flops behind the forearm, he leans into it
      if (this.pose === "wave" && live) { a.s += 7 * Math.sin(t * 7.5 - 0.5); a.e += 26 * Math.sin(t * 7.5); this._handLag = 16 * Math.sin(t * 7.5 - 1.1); lean += 2; headTilt += 4; }
      else this._handLag = 0;
      // talking with the body: a nod on each stressed word, one beat gesture a sentence
      if (this.talkPlan_ && this.talkLeft > 0 && live && this.pose !== "sit") {
        const P = this.talkPlan_, tt = this.talkT;
        let nod = 0; P.nods.forEach((n) => { nod += n.a * pulse((tt - n.t) / 0.24); });
        let g = 0; P.gests.forEach((x) => { const u = (tt - x.t) / 0.62; if (u > 0 && u < 1) g = Math.max(g, u < 0.3 ? ease(u / 0.3) : 1 - ease((u - 0.3) / 0.7)); });
        headTilt += 4 * nod; bodyY += 1.6 * nod; lean += 1.2 * Math.sin(tt * 2.2);
        const busy = this.prop && (this.pose === "hold" || this.pose === "present" || this.pose === "point" || this.pose === "thumbs");
        if (busy) { a.s -= 18 * g; a.e -= 16 * g; } else { a.s -= 38 * g; a.e -= 58 * g; }
      }
      // three cheers (never the same twice in a row): V arms that flutter, a fist pump, a shimmy
      if (this.pose === "cheer" && live) {
        const v = this._cheerV || "v", env = ease(Math.min(1, this._cheerT / 0.2));
        if (v === "v") { a.s += 8 * Math.sin(t * 9); a.bs -= 8 * Math.sin(t * 9); }
        else if (v === "pump") { const pm = Math.max(0, Math.sin(t * 10)); a.s += env * (-14 + 26 * pm); a.e += env * (-40 + 36 * pm); a.bs += env * -90; a.be += env * -110; bodyY += 2 * pm * env; headTilt += 3 * pm * env; }
        else { const w = Math.sin(t * 8); a.s += 20 * w * env; a.bs += 20 * w * env; lean += 4 * w * env; headTilt -= 3 * w * env; bodyY += 1.5 * Math.abs(w) * env; }
      }
      if (this.pose === "boardwave" && live) { a.be += 24 * Math.sin(t * 7.5); headTilt -= 3; }
      this._rideTilt = 0;
      if (this.pose === "ride" && live) {
        const Rd = this.ride || (this.ride = { next: 2.5 + Math.random() * 2, ev: -1, dir: 1 });
        let tilt = 4 * Math.sin(t * 1.1) + 1.8 * Math.sin(t * 2.7);          // the wave rocks the board
        let extraLean = 0, arms = 0, hop = 0;
        a.s += 9 * Math.sin(t * 2.2); a.bs -= 9 * Math.sin(t * 2.2 + 0.7);     // small balancing flutters
        a.kl += 6 * Math.sin(t * 2.2); a.kr -= 6 * Math.sin(t * 2.2 + 0.4);
        Rd.next -= dt;
        if (Rd.next <= 0 && Rd.ev < 0) { Rd.ev = 0; Rd.dir = Math.random() < 0.5 ? -1 : 1; Rd.splashed = false; this.setMood("o"); }
        if (Rd.ev >= 0) {
          Rd.ev += dt / 1.7;
          const e = Rd.ev, ease = (x) => x * x * (3 - 2 * x);
          if (e < 0.55) {                                      // losing it: board tips, he leans too far, arms windmill
            const q = ease(e / 0.55);
            tilt += Rd.dir * 13 * q; extraLean = Rd.dir * 16 * q; arms = 46 * q;
            a.kl += 14 * q; a.kr -= 14 * q;
          } else if (e < 0.82) {                               // the save: a hop that recentres him on the board
            const q = (e - 0.55) / 0.27;
            tilt += Rd.dir * 13 * (1 - ease(q)); extraLean = Rd.dir * 16 * (1 - ease(q)); arms = 46 * (1 - q);
            hop = -30 * Math.sin(Math.PI * q);
            a.kl -= 20 * Math.sin(Math.PI * q); a.kr += 20 * Math.sin(Math.PI * q);
            if (!Rd.splashed) { Rd.splashed = true; this.host.dispatchEvent(new CustomEvent("bloq:splash", { detail: { dir: Rd.dir } })); }
          } else {                                             // landed: knees soak it up, he grins
            const q = (e - 0.82) / 0.18;
            a.kl += 18 * Math.sin(Math.PI * q); a.kr -= 18 * Math.sin(Math.PI * q);
            if (this.el.dataset.mood === "o") this.setMood("laugh", 900);
          }
          if (Rd.ev >= 1) { Rd.ev = -1; Rd.next = 3.5 + Math.random() * 4; }
        }
        a.s += arms * Math.sin(t * 13); a.bs += arms * Math.sin(t * 13 + Math.PI);
        if (this.rideWaving) { a.s = -140; a.e = -20 + 26 * Math.sin(t * 7.5); }
        lean = -0.55 * tilt + extraLean;
        headTilt += -0.4 * tilt;
        bodyY += hop;
        this._rideTilt = tilt;
      }
      if (this.pose === "bike" && live) {
        bodyY += 1.1 * Math.sin(t * 38);                       // engine rumble
        lean = 9 + 1.5 * Math.sin(t * 1.4); headTilt += 1.5 * Math.sin(t * 2.1);
        a.s += 3 * Math.sin(t * 1.4); a.bs += 3 * Math.sin(t * 1.4);
      }
      if (this.pose === "space" && live) {
        bodyY += -14 - 12 * Math.sin(t * 0.9);                 // weightless drift
        this._spaceRot = -8 + 7 * Math.sin(t * 0.55);
        a.s += 7 * Math.sin(t * 1.1); a.bs -= 9 * Math.sin(t * 0.8 + 1);
        a.kl += 10 * Math.sin(t * 0.9); a.kr += 10 * Math.sin(t * 0.9 + 1.4); a.hl += 6 * Math.sin(t * 0.7);
        headTilt += 3 * Math.sin(t * 0.6);
      } else this._spaceRot = 0;
      this._sitSq = 0;
      if (this.pose === "sit" && live) {
        // kicks that come and go (a slow swell with rests, a little change of pace)
        const sw = Math.max(0, Math.sin(t * 0.55) * 0.7 + Math.sin(t * 1.37 + 1) * 0.45 + 0.15), kp = t * 3.1 + 0.5 * Math.sin(t * 0.4);
        a.kl += 14 * Math.min(1, sw) * Math.sin(kp); a.kr += 14 * Math.min(1, sw) * Math.sin(kp + 1.7);
        lean = 2.5 + Math.sin(t * 1.3) * 1.5;                                    // sways while he sits
        if (this.talkLeft > 0) { a.s = -78 + 12 * Math.sin(t * 5.2); a.e = -40 + 9 * Math.sin(t * 4.1); lean = -3; headTilt += 3 * Math.sin(t * 2.6); }
        if (this.sitT >= 0) {
          // get ready (glance down at the seat, hands reach back, a lean), land (the bottom squashes, one soft
          // bounce), settle (a little wiggle)
          const q = this.sitT, rd = pulse(Math.min(1, q / 0.42));
          a.s += 34 * rd; a.bs += 34 * rd; lean += 4 * rd;
          if (q < 0.32) this.look_.ty = 0.9; else if (this.look_.ty === 0.9) this.look_.ty = 0;
          const l_ = q > 0.3 ? (q - 0.3) / 0.7 : 0, imp = q > 0.3 ? Math.exp(-l_ * 4.5) * Math.cos(l_ * 9) : 0;
          bodyY += 6 * Math.max(-0.3, imp); if (q > 0.6) lean += 2.5 * Math.sin(l_ * 12) * (1 - l_);
          a.kl -= 20 * (1 - q); a.kr += 20 * (1 - q);
          this._sitSq = 0.1 * Math.max(-0.3, imp);
        }
      }
      // standing up: lean forward over the feet, hands push on the edge, rise with a stretch, settle
      this._standSt = 0;
      if (this.standT >= 0 && live) {
        const q = this.standT;
        lean -= 9 * pulse(Math.min(1, q / 0.6)); a.s += 30 * pulse(Math.min(1, q / 0.5)); a.bs += 30 * pulse(Math.min(1, q / 0.5));
        this._standSt = 0.05 * pulse((q - 0.35) / 0.5) - 0.025 * pulse((q - 0.78) / 0.22);
      }
      // the surprise take (mood "o"): head and body pull back, eyes go wide; the laugh shakes him a little
      this._eyeWide = 1;
      if (this.takeT >= 0 && live) {
        const q = this.takeT, e = q < 0.25 ? ease(q / 0.25) : 1 - ease((q - 0.25) / 0.75);
        headTilt -= 7 * e; bodyY -= 3 * e; lean += 2.5 * e; this._eyeWide = 1 + 0.22 * e; a.s += 10 * e; a.bs -= 10 * e;
      }
      if (this.el.dataset.mood === "laugh" && live && this.jumpT < 0) { bodyY += 1.6 * Math.abs(Math.sin(t * 13)); headTilt -= 2; }
      // idle beats
      this._idleSt = 0;
      const IB = this.idle.beat;
      if (IB && live) {
        const e = pulse(IB.t);
        if (IB.kind === "shift") { lean += 2.5 * IB.dir * e; a.hl += 5 * IB.dir * e; a.hr += 5 * IB.dir * e; bodyY += 1.2 * e; headTilt -= 1.5 * IB.dir * e; }
        else if (IB.kind === "glance") headTilt += 2 * IB.dir * e;
        else if (IB.kind === "hat") { const g = Math.min(1, e * 1.6); a.s += (-150 - a.s) * g; a.e += (-75 - a.e) * g; if (IB.t > 0.42 && IB.t < 0.47) this.hatLag.v += 40; }
        else { a.s += (-150 - a.s) * e; a.e += (-10 - a.e) * e; a.bs += (150 - a.bs) * e; a.be += (10 - a.be) * e; bodyY -= 3 * e; this._idleSt = 0.04 * e; }
      }
      // props have weight: medium and heavy ones pull the arm down
      const wgt = PROP_W[this.prop] ?? 0, holding = this.prop && (this.pose === "hold" || this.pose === "present");
      if (holding && wgt) { a.s += 6 * wgt; a.e += 4 * wgt; }
      if (floaty && live) { bodyY = -10 - 9 * Math.sin(t * 2.1); a.kl += 14 + 6 * Math.sin(t * 2.1 + 1); a.kr += 22 + 6 * Math.sin(t * 2.1); a.hl += -6; a.hr += 2; }
      else if (live && !this.isWalking) bodyY += Math.sin(t * 1.8) * -2;

      let sx = 1, sy = 1;
      // the hop. Crouch with the arms swinging back; fly a parabola (gravity), stretched by speed, round at the top,
      // legs tucked (big: a real tuck); land with a squash the knees soak up and one small rebound. Volume kept.
      if (this.jumpT >= 0 && this.hop) {
        const H = this.hop.k, tt = this.jumpT * H.total, sz = H.h / 80;
        if (tt < H.c) {
          const q = ease(tt / H.c); bodyY += 10 * q; sy = 1 - 0.08 * q; sx = 1 / sy; a.kl += 34 * q; a.kr += 34 * q; a.s += 22 * q; a.bs += 22 * q; lean += 3 * q;
        } else if (tt < H.c + H.f) {
          const u = (tt - H.c) / H.f, v = 1 - 2 * u;
          bodyY += 10 * Math.max(0, 1 - u * 6) - H.h * 4 * u * (1 - u);
          sy = 1 + Math.min(0.12, 0.1 * Math.abs(v) * Math.min(1.3, sz)); sx = 1 / sy;
          const tuck = H.tuck ? pulse(u) : 0.35 * pulse(u);
          a.kl += 50 * tuck; a.kr += 56 * tuck; a.hl -= 20 * tuck; a.hr -= 14 * tuck;
          if (this.hop.kind === "small") { a.s -= 10 * pulse(u); a.bs -= 10 * pulse(u); }
        } else {
          const q = (tt - H.c - H.f) / H.l, imp = Math.exp(-q * 5) * Math.cos(q * 7.5);
          sy = 1 - H.sq * Math.max(-0.25, imp); sx = 1 / sy; bodyY += 9 * Math.max(0, imp) * Math.min(1.3, sz);
          a.kl += 30 * Math.max(0, imp); a.kr += 30 * Math.max(0, imp);
        }
      }
      // turning between views: a small dip as he swings round (the angles themselves do the turning now)
      if (this.turnT >= 0) bodyY += 2.5 * Math.sin(Math.PI * this.turnT);
      // squash and stretch that keep his volume: sitting down, standing up, the idle stretch
      { const st = -this._sitSq + this._standSt + this._idleSt; if (st) { sy *= 1 + st; sx /= 1 + st; } }
      // the turn (Phase 3: he really turns through the angles, head first). What stays from the squash-swap is the
      // body language: a small dip, the knees stepping round, the arms swinging, the hat swinging after
      if (this.faceT >= 0) {
        const q = this.faceT;
        sy *= 1 + 0.02 * pulse(q / 0.5);
        bodyY += 3.5 * pulse(q / 0.3) - 5 * pulse((q - 0.3) / 0.45);
        a.kl += 26 * pulse((q - 0.2) / 0.4); a.kr += 26 * pulse((q - 0.42) / 0.4);
        a.s += 9 * pulse(q); a.bs -= 9 * pulse(q);
      }
      let rideRot = this.pose === "space" ? (this._spaceRot || 0) : 0;
      if (this.pose === "ride") {
        // keep the shoes on the board whatever the knees do, and rock both with the wave
        const ank = (H, ha, ka) => add(add(H, dir(ha), 34 * a.tl), dir(ha + ka), 33)[1];
        const A = (ank(RIG.front.hipL, a.hl, a.kl) + ank(RIG.front.hipR, a.hr, a.kr)) / 2;
        const bob = live ? 3 * Math.sin(t * 1.8) : 0;
        bodyY += 383 - (A + 24) + bob;
        rideRot = this._rideTilt || 0;
        r.rideboard.setAttribute("transform", `rotate(${f(rideRot)} 156 392) translate(0 ${f(bob)})`);
      }
      this.all.setAttribute("transform", `rotate(${f(rideRot)} 156 392) translate(152 384) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(-152 ${f(-384 + bodyY)})`);

      const hip = [152, 288];
      const T = (p) => { const x = p[0] - hip[0], y = (p[1] - hip[1]) * (1 + breath), c_ = Math.cos(lean * RAD), s_ = Math.sin(lean * RAD); return [hip[0] + x * c_ - y * s_, hip[1] + x * s_ + y * c_]; };
      r.torso.setAttribute("transform", `rotate(${f(lean)} ${hip[0]} ${hip[1]}) translate(0 ${f(hip[1])}) scale(1 ${(1 + breath).toFixed(3)}) translate(0 ${-hip[1]})`);
      // Phase 3: the backpack and the strap at the body's yaw (the pack behind him facing you, in front of him from
      // behind); walking, the pack bounces a little behind the step
      if (yawB !== this._drawnBodyYaw) {
        const Pk = packSvg(yawB), behind = Math.cos(yawB * RAD) > -0.25;
        r.packBack.innerHTML = behind ? Pk.svg : ""; r.packFront.innerHTML = behind ? "" : Pk.svg;
        r.strap3.innerHTML = strapSvg(yawB);
        this._drawnBodyYaw = yawB;
      }
      const bounce = side && live ? `translate(${f(-2 + Math.sin(this.walkPhase * 2 + 0.6) * 1.5)} ${f(Math.sin(this.walkPhase * 2 + 0.9) * 2.5)})` : "";
      r.packBack.setAttribute("transform", bounce); r.packFront.setAttribute("transform", bounce); r.pack.setAttribute("transform", bounce);

      [["legL", "shoeL", J.hipL, a.hl, a.kl, this._rollL], ["legR", "shoeR", J.hipR, a.hr, a.kr, this._rollR]].forEach(([ln, sn, H, ha, ka, roll]) => {
        const K = add(H, dir(ha), 34 * a.tl), A = add(K, dir(ha + ka), 33);
        r[ln].setAttribute("d", limb(H, K, A));
        r[sn].setAttribute("transform", `translate(${f(A[0])} ${f(A[1])}) rotate(${f(MIR * ((ha + ka) * 0.55 + (side ? roll : 0)))}) scale(${MIR} 1)`); // heel-toe roll; the toes point the way he faces
        // sitting: each dangling shoe casts a soft shadow on the card face behind it
        const sh = r[ln === "legL" ? "footShL" : "footShR"];
        sh.setAttribute("cx", f(A[0] + (ln === "legL" ? -6 : 8))); sh.setAttribute("cy", f(A[1] + 30));
      });

      const SF = T(J.shF), EF = add(SF, dir(a.s), 46), WF = add(EF, dir(a.s + a.e), 44);
      // a heavy prop (the cube) takes two hands: the back hand reaches under it (front view)
      this._two += ((holding && wgt === 2 && !side ? 1 : 0) - this._two) * Math.min(1, dt * 8);
      if (this._two > 0.01) { const [ib, ie] = ik(T(J.shB), [WF[0] - 24, WF[1] - 24], 44, 42, 1); a.bs += (ib - a.bs) * this._two; a.be += (ie - a.be) * this._two; }
      const SB = T(J.shB), EB = add(SB, dir(a.bs), 44), WB = add(EB, dir(a.bs + a.be), 42);
      const bArm = "armB", bHand = "handB";
      r[bArm].setAttribute("d", limb(SB, EB, WB));
      r[bHand].setAttribute("transform", `translate(${f(WB[0])} ${f(WB[1])}) rotate(${f(MIR * (a.bs + a.be))}) scale(${MIR} 1)`);
      // Phase 3: turned past 45°, his far shoulder is behind his body, so the back arm goes behind the torso (it used to
      // show through him in profile); facing you it stays in front, as drawn today
      const armBehind = ys > 0.72;
      if (armBehind !== this._armBehind) { this._armBehind = armBehind; const g = r.armBFront; (armBehind ? r.armBBack : this.all).insertBefore(g, armBehind ? null : r.armF); }

      const neck = T([154, 200]);
      const hRot = headTilt + this.look_.x * 6 + lean;
      r.head.setAttribute("transform", `translate(${f(neck[0] - 154)} ${f(neck[1] - 200)}) rotate(${f(hRot)} 154 200)`);
      // Phase 3: the slab, the face laid on its front, the hat round it, all at the head's yaw
      const hy_ = this.headYaw, ears = this.hat && COVERS_EARS.has(this.hat) ? null : this.ears;
      if (hy_ !== this._drawnYaw || ears !== this._drawnEars || this.hat !== this._drawnHat) {
        const Hd = headSvg(hy_, ears), Ht = hatSvg(this.hat, hy_);
        r.headUnder.innerHTML = Hd.under; r.headOver.innerHTML = Hd.over;
        r.hatBack.innerHTML = Ht.back; r.hatFront.innerHTML = Ht.front;
        // a part that lies over the near side of his head (the headset's band) is clipped to the head, a little beyond its outline
        r.hatOver.innerHTML = Ht.over ? `<clipPath id="hc3-${this.id}"><path d="${poly(grown(headHull(hy_), 4.5))}"/></clipPath><g clip-path="url(#hc3-${this.id})">${Ht.over}</g>` : "";
        r.face3.setAttribute("transform", mat(frontMatrix(hy_)));
        r.face3.setAttribute("opacity", Hd.faceOn ? Hd.alpha.toFixed(3) : "0");
        this._drawnYaw = hy_; this._drawnEars = ears; this._drawnHat = this.hat;
      }
      r.eyes.setAttribute("transform", `translate(${f(this.look_.x * 5)} ${f(this.look_.y * 4)})`);
      const bs = this.blink > 0 ? 0.1 : 1, ew = this._eyeWide || 1, ewS = ew.toFixed(3), ehS = (bs * ew).toFixed(3); // wide eyes on a take
      r.eyeL.setAttribute("transform", `translate(136 126) scale(${ewS} ${ehS}) translate(-136 -126)`);
      r.eyeR.setAttribute("transform", `translate(172.5 126) scale(${ewS} ${ehS}) translate(-172.5 -126)`);

      r.brows.setAttribute("transform", `translate(${f(this.look_.x * 3)} ${f(this.brow.y + this.look_.y * 2)})`);


      const hl_ = this.hatLag;
      if (live) {
        hl_.v += (150 * (hRot - hl_.a) - 7 * hl_.v) * dt; hl_.a += hl_.v * dt;
        hl_.vy += (-90 * hl_.y - 6 * hl_.vy) * dt; hl_.y += hl_.vy * dt * 10;
      } else { hl_.a = hRot; hl_.y = 0; }
      // the hat's lag (it swings after the head and bounces on each step) moves the drawn hat
      const hatT = `translate(0 ${f(Math.min(4, hl_.y))}) rotate(${f(hl_.a - hRot)} 152 96)`;
      r.hatBack.setAttribute("transform", hatT); r.hatFront.setAttribute("transform", hatT); r.hatOver.setAttribute("transform", hatT); r.hats.setAttribute("transform", hatT);

      r.armF.setAttribute("d", limb(SF, EF, WF));
      r.handF.setAttribute("transform", `translate(${f(WF[0])} ${f(WF[1])}) rotate(${f(MIR * (a.s + a.e + this._handLag))}) scale(${MIR} 1)`);
      // idle with nothing in hand, the front hand rests on the strap and grips it (today's drawing); any gesture opens it
      const grips = this.pose === "idle" && !this.prop && !this.isWalking && this.jumpT < 0 && Math.abs(this.cur.s - POSES.idle.s) < 12 && Math.abs(this.cur.e - POSES.idle.e) < 12;
      if (grips !== this._grips) { this._grips = grips; r.handOpen.style.display = grips ? "none" : ""; r.handGrip.style.display = grips ? "" : "none"; }
      const sway = live ? Math.sin(t * 2.3) * 4 : 0;
      // the prop trails the hand like a weight on a spring (light: quick and small; heavy: slow and wide)
      const P_ = this.pl;
      if (live && this.prop && dt > 0) {
        const hy = WF[1] + bodyY, vx = P_.lx == null ? 0 : (WF[0] - P_.lx) / dt, vy = P_.ly == null ? 0 : (hy - P_.ly) / dt; P_.lx = WF[0]; P_.ly = hy;
        const K = [320, 170, 100][wgt], C = [24, 17, 13][wgt], G = [0.03, 0.06, 0.09][wgt];
        P_.v += (K * (-G * vx - P_.a) - C * P_.v) * dt; P_.a += P_.v * dt;
        P_.yv += (K * (-G * 0.25 * vy - P_.y) - C * P_.yv) * dt; P_.y += P_.yv * dt;
      } else { P_.a = 0; P_.y = 0; P_.lx = null; P_.ly = null; }
      const swing = Math.max(-25, Math.min(25, P_.a)), drop = Math.max(-6, Math.min(6, P_.y));
      // the arm is drawn behind the prop and the hand over it (svg order: armF, up, handF). The prop sits beyond the
      // hand, never along the forearm: held up as drawn while the forearm points up, out in
      // front when it's level, hanging from the hand when the arm hangs down
      const u_ = dir(a.s + a.e), kk = Math.max(0, Math.min(1, (u_[1] + 0.2) / 0.6)), hk = kk * kk * (3 - 2 * kk);
      const ox = hk * u_[0] * 40, oy = hk * (u_[1] * 40 + 68);   // u_ comes from dir(), already mirrored
      r.up.setAttribute("transform", `translate(${f(WF[0])} ${f(WF[1] + drop)}) rotate(${f(sway * (wgt === 2 ? 0.4 : 1) + swing)}) translate(${f(ox)} ${f(oy)}) scale(1.55)`);
    }
  }

  let last = 0, loopOn = false;
  function frame(now) {
    if (!rigs.size) { loopOn = false; return; }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
    rigs.forEach((b) => { if (b.visible && b.host.isConnected) b._draw(dt); });
    requestAnimationFrame(frame);
  }
  function ensureLoop() { if (loopOn) return; loopOn = true; last = 0; requestAnimationFrame(frame); }

  return {
    BloqRig: Bloq,
    talkPlan, // for the Motion Lab's timeline
    ensureLoop,
    colors: C,
    setHeadAll: (shape) => { headShape = shape; rigs.forEach((b) => b.setHead(shape)); },
    HATS: Object.keys(HATS),
    PROPS: Object.keys(PROPS),
    POSES: Object.keys(POSES),
    OUTFITS: [null, "surf", "agent", "astro"],
  };
})();

export const { BloqRig, colors, setHeadAll, HATS, PROPS, POSES, OUTFITS, talkPlan } = engine;
