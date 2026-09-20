export function VaultMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1.5" y="1.5" width="33" height="33" rx="9" fill="oklch(0.22 0.04 48)" stroke="oklch(0.84 0.13 82 / 0.55)" />
      <path
        d="M8 22c4-9 7-13 10-13s6 4 10 13"
        fill="none"
        stroke="oklch(0.74 0.16 312)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M10 19c3.2-6.2 5.6-9 8-9s4.8 2.8 8 9"
        fill="none"
        stroke="oklch(0.84 0.13 82)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="18" cy="23.5" r="2.1" fill="oklch(0.84 0.13 82)" />
    </svg>
  )
}

export function WatermarkWave() {
  return (
    <svg className="watermark-wave" viewBox="0 0 720 280" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="wave" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.74 0.16 312)" />
          <stop offset="100%" stopColor="oklch(0.84 0.13 82)" />
        </linearGradient>
      </defs>
      {[0, 18, 36, 54, 72].map((offset) => (
        <path
          key={offset}
          d={`M0 ${70 + offset} C 120 ${20 + offset}, 240 ${120 + offset}, 360 ${70 + offset} S 600 ${20 + offset}, 720 ${70 + offset}`}
          fill="none"
          stroke="url(#wave)"
          strokeWidth="1.2"
          opacity={0.55 - offset / 180}
        />
      ))}
    </svg>
  )
}
