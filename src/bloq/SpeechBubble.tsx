/**
 * Glass speech bubble for a section Bloq.
 *
 * Put it inside the same positioned box as the <Bloq/> it belongs to. It sits above him (or beside him,
 * on his left, with side="left"), nudges itself sideways so it never leaves the screen, and on screens
 * under 700px a side bubble moves above him. side="right" is the one exception to the box rule: the
 * bubble is a sibling of Bloq in a row (Bloq first), in the flow, with its tail pointing back at him
 * (the Passport page and the shop). Rule (Nov 9): the tail is always at Bloq's head. A tail on the bubble's bottom
 * edge slides along it to sit under his head, wherever the bubble is placed (nudged on screen, or moved to his left
 * by a page's CSS); a tail on the side (side="left", the hop bubbles) already points at him. Pair it with useSay()
 * and Bloq's talk():
 *
 *   const [line, say] = useSay();
 *   say("Gas is the small fee…");            // shows, auto-hides
 *   bloqRef.current?.talk(2400);
 *   <div className="relative"><Bloq ref={bloqRef} …/><SpeechBubble text={line} /></div>
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** Keep a bubble on screen and its tail at Bloq's head: measure in place, shift by --dx (at once, no slide, so the
 *  bubble and its tail never disagree); a tail on the bottom edge goes under his head (--tx, data-tail="head"). */
export function fitBubble(el: HTMLElement): void {
  el.style.setProperty("--dx", "0px");
  const vw = document.documentElement.clientWidth;
  el.dataset["narrow"] = vw < 700 ? "1" : "0";
  const host = el.offsetParent;
  if (!(host instanceof HTMLElement)) return;
  const hr = host.getBoundingClientRect();
  const left = hr.left + el.offsetLeft, right = left + el.offsetWidth, m = 12;
  let dx = 0;
  if (right > vw - m) dx = vw - m - right;
  if (left + dx < m) dx = m - left;
  el.style.setProperty("--dx", `${Math.round(dx)}px`);
  // Bottom-edge tail (the bubble sits above him): under his head. His head is the middle of his drawing (.bq-host),
  // or of the box he stands in. The tail stays clear of the bubble's rounded corners.
  if (parseFloat(getComputedStyle(el, "::after").bottom) < 0) {
    const r = (host.querySelector(".bq-host") ?? host).getBoundingClientRect();
    const tx = Math.max(14, Math.min(el.offsetWidth - 28, r.left + r.width / 2 - (left + dx) - 7));
    el.style.setProperty("--tx", `${Math.round(tx)}px`);
    el.dataset["tail"] = "head";
  } else delete el.dataset["tail"];
}

export interface SpeechBubbleProps {
  /** null hides it (with a fade); the last text stays while it fades. */
  text: string | null;
  /** above him, beside him on his left, or in a row beside him on his right (in the flow, all widths) */
  side?: "above" | "left" | "right";
  /** dark glass for light sections, light glass for navy sections */
  tone?: "dark" | "light";
  className?: string;
}

export function SpeechBubble({ text, side = "above", tone = "dark", className }: SpeechBubbleProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [shown, setShown] = useState(text ?? "");
  useEffect(() => { if (text) setShown(text); }, [text]);
  useEffect(() => {
    const el = ref.current;
    if (!el || !text || side === "right") return; // in the flow: the row keeps it on screen
    fitBubble(el);
    // Bloq can move while he talks (walking, hopping, floating): keep re-fitting while visible
    const id = window.setInterval(() => fitBubble(el), 350);
    const onResize = () => fitBubble(el);
    window.addEventListener("resize", onResize);
    return () => { window.clearInterval(id); window.removeEventListener("resize", onResize); };
  }, [text, shown, side]);
  return (
    <p
      ref={ref}
      aria-live="polite"
      data-side={side}
      className={["bloq-say", tone, text ? "" : "hide", className ?? ""].join(" ")}
    >
      {shown}
    </p>
  );
}

/** A line that hides itself: reading time ≈ 60 ms a character, at least 4.2 s. */
export function useSay(): [string | null, (text: string, ms?: number) => void] {
  const [line, setLine] = useState<string | null>(null);
  const t = useRef<number | undefined>(undefined);
  const say = useCallback((text: string, ms?: number) => {
    setLine(text);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setLine(null), ms ?? Math.max(4200, text.length * 60));
  }, []);
  useEffect(() => () => window.clearTimeout(t.current), []);
  return [line, say];
}

/** How long Bloq's mouth should move for a line. */
export const talkMs = (text: string): number => Math.min(4200, 900 + text.length * 26);
