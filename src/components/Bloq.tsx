import { motion, useReducedMotion } from "framer-motion";

/** Bloq the merchant: three stacked rounded blocks — navy body, lavender band, lime head with ivory eyes. */
export function BloqCharacter({ size = 112, pose = 0 }: { size?: number; pose?: number }) {
  const reduce = useReducedMotion();
  const tilt = [0, -4, 3, -2][pose % 4];
  const lift = [0, -4, -2, -5][pose % 4];
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Bloq the merchant"
      initial={false}
      animate={{ rotate: tilt, y: lift }}
      transition={reduce ? { duration: 0 } : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{ originX: 0.5, originY: 1 }}
    >
      <rect x="18" y="74" width="84" height="38" rx="14" className="fill-navy-soft stroke-lavender/40" strokeWidth="1.5" />
      <rect x="26" y="60" width="70" height="18" rx="8" className="fill-lavender" />
      <motion.g initial={false} animate={{ x: tilt * 0.8 }} transition={reduce ? { duration: 0 } : { duration: 0.6 }}>
        <rect x="30" y="14" width="62" height="46" rx="16" className="fill-lime" />
        <rect x="45" y="30" width="9" height="12" rx="4" className="fill-ivory stroke-navy" strokeWidth="2" />
        <rect x="68" y="30" width="9" height="12" rx="4" className="fill-ivory stroke-navy" strokeWidth="2" />
        <circle cx="50" cy="37" r="2.2" className="fill-navy" />
        <circle cx="73" cy="37" r="2.2" className="fill-navy" />
      </motion.g>
    </motion.svg>
  );
}

/** Bloq's line, chosen by his stock of the item last traded. */
export function bloqLine(stock: number, shopOpen: boolean): string {
  if (!shopOpen) return "My treasury's thin. Come back when it refills.";
  if (stock < 10) return "I'm short on those. I'll pay well.";
  if (stock < 40) return "Fair stock. Fair price.";
  return "I've got plenty of those already. I'll pay less.";
}
