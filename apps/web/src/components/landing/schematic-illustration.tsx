export function SchematicIllustration() {
  return (
    <svg
      viewBox="0 0 640 560"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-auto w-full max-w-xl"
      role="img"
      aria-label="Exploded schematic of an AI Employee assembled from a reasoning core, memory, knowledge, and tools modules"
    >
      {/* corner registration marks */}
      {[
        [24, 24],
        [616, 24],
        [24, 536],
        [616, 536]
      ].map(([x, y]) => (
        <g key={`${x}-${y}`} stroke="#3A5878" strokeWidth="1">
          <line x1={x - 10} y1={y} x2={x + 10} y2={y} />
          <line x1={x} y1={y - 10} x2={x} y2={y + 10} />
        </g>
      ))}

      {/* coordinate ticks */}
      <text x="24" y="16" fill="#5B7794" fontFamily="IBM Plex Mono, monospace" fontSize="10">
        AF-01 / EMPLOYEE ASSEMBLY
      </text>
      <text
        x="616"
        y="552"
        fill="#5B7794"
        fontFamily="IBM Plex Mono, monospace"
        fontSize="10"
        textAnchor="end"
      >
        REV. C
      </text>

      {/* connecting leader lines, drawn first so modules sit on top */}
      <g stroke="#2C4864" strokeWidth="1.5" strokeDasharray="4 4">
        <line x1="320" y1="280" x2="150" y2="120" />
        <line x1="320" y1="280" x2="490" y2="120" />
        <line x1="320" y1="280" x2="150" y2="440" />
        <line x1="320" y1="280" x2="490" y2="440" />
      </g>

      {/* central core silhouette */}
      <g>
        <path
          d="M320 200 L390 240 L390 320 L320 360 L250 320 L250 240 Z"
          fill="#111B2E"
          stroke="#5EEAD4"
          strokeWidth="1.5"
        />
        <circle cx="320" cy="280" r="26" fill="none" stroke="#FF8A3D" strokeWidth="1.5" />
        <circle cx="320" cy="280" r="4" fill="#FF8A3D" />
        <text
          x="320"
          y="392"
          textAnchor="middle"
          fill="#8FA8C2"
          fontFamily="IBM Plex Mono, monospace"
          fontSize="11"
        >
          MOD.00 — REASONING CORE
        </text>
      </g>

      {/* Module: Memory (top-left) */}
      <g>
        <rect x="110" y="80" width="80" height="60" rx="4" fill="#111B2E" stroke="#5EEAD4" strokeWidth="1.2" />
        <line x1="122" y1="98" x2="178" y2="98" stroke="#5EEAD4" strokeWidth="1.2" />
        <line x1="122" y1="110" x2="178" y2="110" stroke="#5EEAD4" strokeWidth="1.2" />
        <line x1="122" y1="122" x2="178" y2="122" stroke="#5EEAD4" strokeWidth="1.2" />
        <text x="150" y="158" textAnchor="middle" fill="#8FA8C2" fontFamily="IBM Plex Mono, monospace" fontSize="10">
          MOD.01 — MEMORY
        </text>
      </g>

      {/* Module: Knowledge (top-right) */}
      <g>
        <rect x="450" y="80" width="80" height="60" rx="4" fill="#111B2E" stroke="#5EEAD4" strokeWidth="1.2" />
        <path d="M462 96 h56 M462 108 h56 M462 120 h40" stroke="#5EEAD4" strokeWidth="1.2" />
        <text x="490" y="158" textAnchor="middle" fill="#8FA8C2" fontFamily="IBM Plex Mono, monospace" fontSize="10">
          MOD.02 — KNOWLEDGE
        </text>
      </g>

      {/* Module: Tools (bottom-left) */}
      <g>
        <rect x="110" y="400" width="80" height="60" rx="4" fill="#111B2E" stroke="#5EEAD4" strokeWidth="1.2" />
        <circle cx="140" cy="430" r="10" fill="none" stroke="#5EEAD4" strokeWidth="1.2" />
        <line x1="148" y1="438" x2="168" y2="446" stroke="#5EEAD4" strokeWidth="1.2" />
        <text x="150" y="478" textAnchor="middle" fill="#8FA8C2" fontFamily="IBM Plex Mono, monospace" fontSize="10">
          MOD.03 — TOOLS
        </text>
      </g>

      {/* Module: Teams (bottom-right) */}
      <g>
        <rect x="450" y="400" width="80" height="60" rx="4" fill="#111B2E" stroke="#5EEAD4" strokeWidth="1.2" />
        <circle cx="478" cy="424" r="8" fill="none" stroke="#5EEAD4" strokeWidth="1.2" />
        <circle cx="500" cy="424" r="8" fill="none" stroke="#5EEAD4" strokeWidth="1.2" />
        <path d="M468 444 q22 -14 44 0" stroke="#5EEAD4" strokeWidth="1.2" fill="none" />
        <text x="490" y="478" textAnchor="middle" fill="#8FA8C2" fontFamily="IBM Plex Mono, monospace" fontSize="10">
          MOD.04 — TEAMS
        </text>
      </g>
    </svg>
  );
}
