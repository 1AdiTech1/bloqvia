type Tone = "lime" | "navy";
const fill = (t: Tone) => (t === "lime" ? "fill-lime" : "fill-navy");

/** Primary mark: three offset rounded blocks stacked into a "B". */
export function BloqMark({ size = 40, tone = "navy" }: { size?: 24 | 40 | number; tone?: Tone }) {
  const f = fill(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="6" y="3" width="22" height="10" rx="4" className={f} />
      <rect x="6" y="15" width="26" height="10" rx="4" className={f} opacity="0.85" />
      <rect x="6" y="27" width="28" height="10" rx="4" className={f} />
    </svg>
  );
}

/** Alternate A: spine + two offset blocks. */
export function BloqMarkAltA({ size = 40, tone = "navy" }: { size?: number; tone?: Tone }) {
  const f = fill(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="5" y="3" width="9" height="34" rx="4" className={f} />
      <rect x="16" y="3" width="15" height="15" rx="5" className={f} />
      <rect x="16" y="21" width="19" height="16" rx="5" className={f} />
    </svg>
  );
}

/** Alternate B: isometric-leaning blocks with a lifted middle. */
export function BloqMarkAltB({ size = 40, tone = "navy" }: { size?: number; tone?: Tone }) {
  const f = fill(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="4" y="4" width="22" height="10" rx="5" className={f} />
      <rect x="10" y="15" width="22" height="10" rx="5" className={f} opacity="0.7" />
      <rect x="4" y="26" width="30" height="10" rx="5" className={f} />
    </svg>
  );
}

export function Wordmark({ tone = "navy", size = 24 }: { tone?: Tone; size?: 24 | 40 }) {
  return (
    <span className="flex items-center gap-2.5">
      <BloqMark size={size} tone={tone} />
      <span
        className={`font-display font-medium tracking-[-0.04em] ${size === 40 ? "text-3xl" : "text-lg"} ${tone === "lime" ? "text-ivory" : "text-navy"}`}
      >
        Bloqvia
      </span>
    </span>
  );
}

/** Back-compat for existing imports. */
export const LogoBadge = ({ size = 40 }: { size?: number }) => <BloqMark size={size} />;
