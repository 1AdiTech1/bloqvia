/**
 * <BloqCoin/> — the BloqGold coin: a lime disc with an inner ring and the Bloqvia block mark.
 * The same coin Bloq holds in his hand (engine prop "coin"). Use it everywhere BloqGold is drawn.
 *
 *   <BloqCoin size={20} />            // inventory chip, reward chip, shop
 *   <BloqCoin size={28} label="BloqGold" />  // standalone, announced to screen readers
 */
export function BloqCoin({ size = 20, className, label }: { size?: number; className?: string; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <circle cx="12" cy="12" r="10.4" fill="#d4f033" stroke="#121a28" strokeWidth="1.3" />
      <circle cx="12" cy="12" r="7.6" fill="none" stroke="#a6c21a" strokeWidth="1.1" />
      <g transform="translate(7.3 7.2) scale(.215)">
        <rect x="1" y="29" width="42" height="12" rx="6" fill="#16243a" />
        <rect x="1" y="15.5" width="36" height="12" rx="6" fill="#16243a" opacity=".78" />
        <rect x="1" y="2" width="31" height="12" rx="6" fill="#16243a" />
      </g>
    </svg>
  );
}
