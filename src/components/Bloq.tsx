/** Bloq the merchant: a friendly round sprout-headed shopkeeper. */
export function BloqCharacter({ size = 110 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-label="Bloq the merchant" className="animate-float">
      <path d="M60 22c-2-10 4-18 14-19-1 10-6 16-14 19Z" className="fill-leaf" />
      <path d="M60 22c0-9-6-15-14-15 0 8 5 14 14 15Z" className="fill-sage" />
      <path d="M60 18v10" className="stroke-moss" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="60" cy="72" rx="44" ry="42" className="fill-sun" />
      <ellipse cx="60" cy="80" rx="30" ry="24" className="fill-sun-soft" />
      <circle cx="45" cy="64" r="5.5" className="fill-bark" />
      <circle cx="75" cy="64" r="5.5" className="fill-bark" />
      <circle cx="47" cy="62" r="1.8" className="fill-cream" />
      <circle cx="77" cy="62" r="1.8" className="fill-cream" />
      <ellipse cx="36" cy="77" rx="6" ry="3.5" className="fill-terracotta" opacity="0.45" />
      <ellipse cx="84" cy="77" rx="6" ry="3.5" className="fill-terracotta" opacity="0.45" />
      <path d="M50 80c5 6 15 6 20 0" fill="none" strokeWidth="3.5" strokeLinecap="round" className="stroke-bark" />
      <path d="M16 104c12-8 76-8 88 0v8H16Z" className="fill-moss" />
    </svg>
  );
}

export function bloqMood(stocks: number[]): string {
  const total = stocks.reduce((a, b) => a + b, 0);
  const min = Math.min(...stocks);
  if (min === 0) return "I'm all out of something! I'll pay well if you bring it.";
  if (total <= 12) return "Shelves are looking thin… sell me something, friend!";
  if (total >= 30) return "My stall is overflowing! Bargains for buyers today.";
  return "Fresh from the garden! What are we trading today?";
}
