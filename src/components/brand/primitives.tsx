import { forwardRef, useRef, type ComponentProps, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const ease = [0.22, 1, 0.36, 1] as const;

/** Scroll-triggered fade-up. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, ease, delay }}
    >
      {children}
    </motion.div>
  );
}

type Tone = "ivory" | "navy" | "lavender";
const toneCls: Record<Tone, string> = {
  ivory: "bg-ivory text-navy",
  navy: "bg-night text-ivory",
  lavender: "bg-lavender-soft text-navy",
};

export const Section = forwardRef<HTMLElement, ComponentProps<"section"> & { tone?: Tone; inner?: string }>(
  ({ tone = "ivory", className, inner, children, ...rest }, ref) => (
    <section ref={ref} className={cn("relative overflow-hidden", toneCls[tone], className)} {...rest}>
      <div className={cn("mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-32", inner)}>{children}</div>
    </section>
  ),
);
Section.displayName = "Section";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("mb-5 flex items-center gap-3 font-display text-xs font-medium uppercase tracking-[0.22em] opacity-80", className)}>
      <span className="h-px w-8 bg-current" />
      {children}
    </p>
  );
}

const sizes = { xl: "text-display-xl", lg: "text-display-lg", md: "text-display-md" };
export function Display({
  lines,
  size = "lg",
  as: Tag = "h2",
  accent,
  className,
}: {
  lines: string[];
  size?: keyof typeof sizes;
  as?: "h1" | "h2" | "h3";
  /** index of a line rendered in the accent colour */
  accent?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <Tag className={cn("font-display font-medium uppercase tracking-[-0.045em]", sizes[size], className)}>
      {lines.map((l, i) => (
        <span key={i} className="block overflow-hidden pb-[0.06em]">
          <motion.span
            className={cn("block", accent === i && "text-[color:var(--display-accent,var(--lavender))]")}
            initial={reduce ? false : { y: "105%" }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease, delay: 0.1 + i * 0.12 }}
          >
            {l}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

type CTAVariant = "lime" | "navy" | "ghost-light" | "ghost-dark";
const ctaCls: Record<CTAVariant, string> = {
  lime: "bg-lime text-navy hover:shadow-[0_10px_30px_-8px_var(--lime)]",
  navy: "bg-navy text-ivory hover:bg-navy-soft",
  "ghost-light": "border border-ivory/30 text-ivory hover:bg-ivory/10",
  "ghost-dark": "border border-navy/25 text-navy hover:bg-navy/5",
};
export function CTA({
  variant = "lime",
  arrow = true,
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: CTAVariant; arrow?: boolean }) {
  return (
    <button
      className={cn(
        "tap group inline-flex items-center justify-center gap-3 rounded-full px-7 py-3.5 font-display text-sm font-medium uppercase tracking-[0.12em] transition-all duration-300 ease-calm hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current disabled:opacity-60",
        ctaCls[variant],
        className,
      )}
      {...rest}
    >
      {children}
      {arrow && <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />}
    </button>
  );
}

/* ---------- Illustration slot ---------- */

export type Composition = "hero" | "network" | "lab" | "vault" | "fuel" | "contract" | "rewards";
const ratios = {
  hero: "aspect-[4/3] md:aspect-[16/10]",
  square: "aspect-square",
  wide: "aspect-[3/2]",
};

export function Illustration({
  src,
  alt = "",
  ratio = "square",
  composition = "network",
  className,
}: {
  src?: string;
  alt?: string;
  ratio?: keyof typeof ratios;
  composition?: Composition;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const back = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [30, -30]);
  const front = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [70, -70]);

  return (
    <div ref={ref} className={cn("relative w-full overflow-hidden rounded-[2rem] bg-night", ratios[ratio], className)}>
      {src ? (
        <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : (
        <>
          <motion.div style={{ y: back }} className="absolute inset-0">
            <BackLayer />
          </motion.div>
          <motion.div style={{ y: front }} className="absolute inset-0">
            <FrontLayer kind={composition} />
          </motion.div>
          <span className="sr-only">{alt}</span>
        </>
      )}
    </div>
  );
}

function BackLayer() {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id="glowL" cx="70%" cy="25%" r="60%">
          <stop offset="0" stopColor="var(--lavender)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--lavender)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#glowL)" />
      {Array.from({ length: 9 }).map((_, i) => (
        <line key={i} x1={i * 50} y1="0" x2={i * 50 - 120} y2="300" stroke="var(--ivory)" strokeOpacity="0.06" />
      ))}
    </svg>
  );
}

function Block({ x, y, w, h, c, r = 14, o = 1 }: { x: number; y: number; w: number; h: number; c: string; r?: number; o?: number }) {
  return (
    <g opacity={o}>
      <rect x={x + 6} y={y + 10} width={w} height={h} rx={r} fill="black" opacity="0.25" />
      <rect x={x} y={y} width={w} height={h} rx={r} fill={c} />
      <rect x={x} y={y} width={w} height={h * 0.35} rx={r} fill="white" opacity="0.18" />
    </g>
  );
}

function FrontLayer({ kind }: { kind: Composition }) {
  const L = "var(--lime)", V = "var(--lavender)", C = "var(--coral)", I = "var(--ivory)";
  const drift = "animate-float";
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" className="h-full w-full" aria-hidden="true">
      {kind === "hero" && (
        <>
          <path d="M60 230 C 140 200, 170 120, 250 110 S 360 60, 380 40" fill="none" stroke={L} strokeWidth="1.5" strokeDasharray="4 6" opacity="0.7" />
          <g className={drift}><Block x={150} y={120} w={110} h={70} c={V} r={18} /></g>
          <g className={drift} style={{ animationDelay: "-2s" }}><Block x={215} y={70} w={90} h={56} c={L} r={16} /></g>
          <g className={drift} style={{ animationDelay: "-4s" }}><Block x={110} y={180} w={80} h={50} c={C} r={14} o={0.95} /></g>
          <circle cx="320" cy="200" r="22" fill="none" stroke={I} strokeOpacity="0.5" />
          <circle cx="320" cy="200" r="6" fill={L} />
          <circle cx="70" cy="80" r="4" fill={I} opacity="0.7" />
          <circle cx="350" cy="60" r="3" fill={V} />
        </>
      )}
      {kind === "network" && (
        <>
          {[[100, 90], [300, 80], [200, 160], [90, 220], [310, 225]].map(([x, y], i, a) =>
            a.slice(i + 1).map(([x2, y2], j) => (
              <line key={`${i}-${j}`} x1={x} y1={y} x2={x2} y2={y2} stroke={I} strokeOpacity="0.18" />
            )),
          )}
          {[[100, 90, V], [300, 80, L], [200, 160, I], [90, 220, L], [310, 225, C]].map(([x, y, c], i) => (
            <g key={i} className={drift} style={{ animationDelay: `-${i}s` }}>
              <Block x={(x as number) - 22} y={(y as number) - 16} w={44} h={32} c={c as string} r={10} />
            </g>
          ))}
        </>
      )}
      {kind === "lab" && (
        <>
          <ellipse cx="200" cy="250" rx="150" ry="22" fill={V} opacity="0.2" />
          <rect x="110" y="70" width="180" height="170" rx="24" fill="none" stroke={I} strokeOpacity="0.25" />
          <g className={drift}><Block x={150} y={150} w={100} h={60} c={L} /></g>
          <g className={drift} style={{ animationDelay: "-3s" }}><Block x={175} y={95} w={50} h={40} c={C} r={10} /></g>
          <path d="M60 60 L110 90 M340 60 L290 90" stroke={L} strokeOpacity="0.5" strokeDasharray="3 5" />
        </>
      )}
      {kind === "vault" && (
        <>
          <circle cx="200" cy="150" r="80" fill="none" stroke={L} strokeWidth="2" opacity="0.6" />
          <circle cx="200" cy="150" r="56" fill={V} opacity="0.9" />
          <rect x="190" y="120" width="20" height="44" rx="10" fill="var(--navy)" />
          <circle cx="200" cy="120" r="14" fill="var(--navy)" />
        </>
      )}
      {kind === "fuel" && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <g key={i} className={drift} style={{ animationDelay: `-${i * 1.2}s` }}>
              <Block x={110 + i * 46} y={200 - i * 34} w={40} h={40 + i * 34} c={i === 3 ? L : V} r={10} o={0.6 + i * 0.13} />
            </g>
          ))}
        </>
      )}
      {kind === "contract" && (
        <>
          <g className={drift}><Block x={130} y={70} w={140} h={170} c={I} r={18} /></g>
          {[0, 1, 2, 3].map((i) => <rect key={i} x="155" y={100 + i * 22} width={i === 3 ? 60 : 90} height="8" rx="4" fill="var(--navy)" opacity="0.3" />)}
          <circle cx="240" cy="205" r="22" fill={C} />
          <path d="M230 205 l7 7 l13 -14" stroke="var(--navy)" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      )}
      {kind === "rewards" && (
        <>
          <g className={drift}><Block x={150} y={80} w={100} h={140} c={V} r={16} /></g>
          <circle cx="110" cy="200" r="26" fill={L} />
          <circle cx="300" cy="110" r="18" fill={C} />
        </>
      )}
    </svg>
  );
}
