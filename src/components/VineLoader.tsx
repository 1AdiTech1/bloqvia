export function VineLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-2" role="status" aria-live="polite">
      <svg width="160" height="48" viewBox="0 0 160 48" aria-hidden="true">
        <path
          d="M4 36 C 30 6, 50 46, 80 24 S 130 4, 156 22"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="animate-vine stroke-leaf"
        />
        {[30, 70, 110, 145].map((x, i) => (
          <ellipse
            key={x}
            cx={x}
            cy={i % 2 ? 14 : 30}
            rx="6"
            ry="3.5"
            className="animate-leaf fill-sage"
            style={{ animationDelay: `${i * 0.25}s` }}
          />
        ))}
      </svg>
      <p className="font-medium text-moss">{label}</p>
    </div>
  );
}

export function LeafDivider() {
  return (
    <div className="flex items-center gap-3 text-sage" aria-hidden="true">
      <span className="h-px flex-1 bg-border" />
      <svg width="40" height="16" viewBox="0 0 40 16">
        <path d="M2 8h36" className="stroke-sage" strokeWidth="1.5" />
        <path d="M20 8c-4-6-10-6-12-4 2 4 8 5 12 4Z" className="fill-sage" />
        <path d="M20 8c4 6 10 6 12 4-2-4-8-5-12-4Z" className="fill-leaf" />
      </svg>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
