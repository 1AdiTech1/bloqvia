export function LogoBadge({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M24 3C36 3 45 12 45 24C45 36 36 45 24 45C12 45 3 36 3 24C3 14 9 5 24 3Z"
        className="fill-moss"
      />
      <path
        d="M17 13h9.5c4.2 0 7 2.4 7 5.8 0 2.3-1.3 4-3.3 4.8 2.6.7 4.3 2.7 4.3 5.4 0 3.9-3 6-7.6 6H17V13Z"
        className="fill-cream"
      />
      <path d="M21.5 17.5h4.3c1.8 0 2.9.9 2.9 2.4s-1.1 2.4-2.9 2.4h-4.3Z" className="fill-moss" />
      <path d="M21.5 26.2h5c2 0 3.2 1 3.2 2.6s-1.2 2.6-3.2 2.6h-5Z" className="fill-moss" />
      <path d="M33 6c4 1 7 4 8 8-4 0-7-3-8-8Z" className="fill-sun" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <LogoBadge />
      <span className="font-display text-xl font-bold tracking-tight text-moss">Bloqvia</span>
    </span>
  );
}
