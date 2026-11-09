import { useEffect, useRef, useState } from "react";
import { useMotionOff } from "@/bloq";

const isIOS = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Our own lime page-scroll indicator for touch screens (phones, tablets),
 * where browsers ignore scroll-bar colours. Not drawn on iOS: Safari always
 * shows its own page indicator, and two bars would be worse than one grey one.
 */
export function TouchScrollbar() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setOn(mq.matches && !isIOS());
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return on ? <Indicator /> : null;
}

function Indicator() {
  const pill = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [fits, setFits] = useState(true);
  const reduce = useMotionOff();

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("touch-sb");
    let hide: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;

    const place = () => {
      raf = 0;
      const vh = window.innerHeight;
      const sh = html.scrollHeight;
      const el = pill.current;
      setFits(sh <= vh + 1);
      if (!el || sh <= vh + 1) return;
      const len = Math.max(40, (vh * vh) / sh);
      const top = (window.scrollY / (sh - vh)) * (vh - len);
      el.style.height = `${len}px`;
      el.style.transform = `translateY(${Math.min(vh - len, Math.max(0, top))}px)`;
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(place); };
    const onScroll = () => {
      queue();
      setVisible(true);
      clearTimeout(hide);
      hide = setTimeout(() => setVisible(false), 1000);
    };
    place();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", queue);
    const ro = new ResizeObserver(queue);
    ro.observe(document.body);

    // Drag the invisible strip to scroll the page.
    const s = strip.current;
    const drag = (e: PointerEvent) => {
      const vh = window.innerHeight;
      const sh = html.scrollHeight;
      const len = Math.max(40, (vh * vh) / sh);
      const ratio = Math.min(1, Math.max(0, (e.clientY - len / 2) / (vh - len)));
      window.scrollTo({ top: ratio * (sh - vh), behavior: "auto" });
    };
    const down = (e: PointerEvent) => {
      s?.setPointerCapture(e.pointerId);
      drag(e);
      s?.addEventListener("pointermove", drag);
    };
    const up = () => s?.removeEventListener("pointermove", drag);
    s?.addEventListener("pointerdown", down);
    s?.addEventListener("pointerup", up);
    s?.addEventListener("pointercancel", up);

    return () => {
      html.classList.remove("touch-sb");
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", queue);
      ro.disconnect();
      clearTimeout(hide);
      if (raf) cancelAnimationFrame(raf);
      s?.removeEventListener("pointerdown", down);
      s?.removeEventListener("pointerup", up);
      s?.removeEventListener("pointercancel", up);
      s?.removeEventListener("pointermove", drag);
    };
  }, []);

  return (
    <div aria-hidden="true" className="touch-sb-rail" style={fits ? { display: "none" } : undefined}>
      <div ref={strip} className="touch-sb-strip" />
      <div
        ref={pill}
        className="touch-sb-pill"
        style={{ opacity: visible ? 1 : 0, transition: reduce ? "none" : `opacity ${visible ? ".12s" : ".35s"} ease` }}
      />
    </div>
  );
}
