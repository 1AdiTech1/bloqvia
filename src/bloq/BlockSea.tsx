/**
 * The block sea under the surfing Bloq ("Ready when you are."): columns of blocks scroll left while two
 * waves pass through them, rounded to whole blocks; tall crests turn lime and now and then a block
 * flashes lime (a new block joining the chain). The rider element is lifted to the top of the column
 * under his middle every frame, so his board glides up and down the steps.
 *
 *   <div className="relative pt-5">
 *     <BlockSea riderRef={hostRef} />
 *     <div ref={hostRef} className="relative z-[2] mx-auto mb-[52px] mt-[110px] w-[clamp(210px,25vw,300px)]">
 *       <Bloq hat="surf" outfit="surf" pose="ride" … />
 *     </div>
 *   </div>
 */
import { useEffect, useRef, type RefObject } from "react";

const SZ = 20, GAP = 3, STEP = SZ + GAP;

interface Layer { id: string; base: number; amp: number; w: number; ph: number; speed: number; c: [string, string, string]; lime: number; alpha: number; flash: boolean }
const BACK: Layer = { id: "b", base: 92, amp: 34, w: 1.2, ph: 0, speed: 46, c: ["#5a2aa3", "#7a3fc9", "#9d5ee6"], lime: 6, alpha: 1, flash: true };
const FRONT: Layer = { id: "f", base: 26, amp: 16, w: 1.8, ph: 2.1, speed: 72, c: ["#8b45d9", "#b47ff0", "#c9a6f3"], lime: 3, alpha: 0.85, flash: false };

const waveH = (x: number, t: number, L: Layer) =>
  L.base + L.amp * Math.sin(x * 0.012 - t * L.w + L.ph) + L.amp * 0.45 * Math.sin(x * 0.012 * 2.3 - t * L.w * 1.7 + L.ph * 2);

function block(g: CanvasRenderingContext2D, x: number, y: number, fill: string, top: string) {
  g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, SZ, SZ, 4); g.fill();
  g.fillStyle = top; g.beginPath(); g.roundRect(x + 2, y + 2, SZ - 4, 4, 2); g.fill();
  g.strokeStyle = "rgba(27,22,34,.55)"; g.lineWidth = 1.5; g.beginPath(); g.roundRect(x + 0.75, y + 0.75, SZ - 1.5, SZ - 1.5, 4); g.stroke();
}

function draw(c: HTMLCanvasElement, t: number, L: Layer, flashes: Map<string, number>) {
  const r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const g = c.getContext("2d"); if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
  const shift = (t * L.speed) % STEP;
  for (let i = -1; i * STEP - shift < r.width + STEP; i++) {
    const x = i * STEP - shift, col = i + Math.floor((t * L.speed) / STEP);
    const n = Math.max(1, Math.round(waveH(x, t, L) / STEP));
    for (let j = 0; j < n; j++) {
      const y = r.height - (j + 1) * STEP + GAP, key = `${L.id}:${col}:${j}`;
      let fill = j < 2 ? L.c[0] : j < 4 ? L.c[1] : L.c[2], top = "rgba(255,255,255,.35)";
      if (j === n - 1 && n >= L.lime) { fill = "#d4f033"; top = "rgba(255,255,255,.6)"; }
      const fl = flashes.get(key);
      if (fl !== undefined) { if (t - fl > 0.9) flashes.delete(key); else fill = "#d4f033"; }
      g.globalAlpha = L.alpha; block(g, x, y, fill, top);
    }
    if (L.flash && Math.random() < 0.0016) flashes.set(`${L.id}:${col}:${Math.floor(Math.random() * n)}`, t);
  }
  g.globalAlpha = 1;
}

export function BlockSea({ riderRef }: { riderRef?: RefObject<HTMLElement | null> }) {
  const back = useRef<HTMLCanvasElement>(null), front = useRef<HTMLCanvasElement>(null), box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const flashes = new Map<string, number>();
    let on = true, raf = 0, rideY = 92;
    const t0 = performance.now();
    const io = new IntersectionObserver((es) => { on = !!es[0]?.isIntersecting; }, { rootMargin: "100px" });
    if (box.current) io.observe(box.current);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!on || !back.current || !front.current || !box.current) return;
      const t = reduce ? 0 : (now - t0) / 1000;
      draw(back.current, t, BACK, flashes); draw(front.current, t, FRONT, flashes);
      const rider = riderRef?.current; if (!rider) return;
      const sr = box.current.getBoundingClientRect(), hr = rider.getBoundingClientRect();
      const cx = hr.left - sr.left + hr.width / 2, shift = (t * BACK.speed) % STEP;
      const x = Math.round((cx + shift) / STEP) * STEP - shift;
      const top = Math.max(1, Math.round(waveH(x, t, BACK) / STEP)) * STEP - GAP;
      rideY += (top - rideY) * (reduce ? 1 : 0.12);
      rider.style.transform = `translateY(${(-(rideY - 50)).toFixed(1)}px)`;
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [riderRef]);
  return (
    <div ref={box} aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <canvas ref={back} style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: 200, zIndex: 1 }} />
      <canvas ref={front} style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: 64, zIndex: 3 }} />
    </div>
  );
}
