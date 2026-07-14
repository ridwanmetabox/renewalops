"use client";

function LogoMark({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className}>
      <rect x="2" y="2" width="22" height="6" fill="currentColor" />
      <rect x="2" y="32" width="22" height="6" fill="currentColor" />
      <rect x="2" y="2" width="6" height="36" fill="currentColor" />
      <rect x="14" y="14" width="10" height="12" fill="currentColor" />
      <rect x="28" y="2" width="6" height="6" fill="currentColor" />
      <rect x="34" y="8" width="6" height="6" fill="currentColor" />
    </svg>
  );
}

const NET_NODES = [
  { x: 22, y: 14 },
  { x: 68, y: 10 },
  { x: 44, y: 30 },
  { x: 82, y: 26 },
  { x: 14, y: 48 },
  { x: 57, y: 46 },
  { x: 88, y: 55 },
  { x: 30, y: 65 },
  { x: 72, y: 70 },
  { x: 48, y: 80 },
  { x: 12, y: 80 },
  { x: 78, y: 86 },
  { x: 36, y: 12 },
  { x: 62, y: 28 },
  { x: 24, y: 90 },
  { x: 55, y: 62 },
];

const NET_EDGES = [
  [0, 2],
  [0, 12],
  [1, 2],
  [1, 3],
  [2, 5],
  [2, 12],
  [3, 6],
  [3, 13],
  [4, 7],
  [4, 10],
  [5, 6],
  [5, 13],
  [5, 15],
  [6, 8],
  [7, 9],
  [7, 10],
  [8, 9],
  [8, 11],
  [9, 14],
  [12, 13],
  [13, 15],
  [15, 8],
];

function LoginAnimation() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none text-zinc-900/40">
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {NET_EDGES.map(([a, b], i) => (
          <line
            key={`e${i}`}
            x1={`${NET_NODES[a].x}%`}
            y1={`${NET_NODES[a].y}%`}
            x2={`${NET_NODES[b].x}%`}
            y2={`${NET_NODES[b].y}%`}
            stroke="currentColor"
            strokeWidth="0.6"
            style={{
              animation: `edgePulse 4s ${(i * 0.28) % 3.5}s ease-in-out infinite`,
            }}
          />
        ))}

        {NET_NODES.map((n, i) => (
          <circle
            key={`p${i}`}
            cx={`${n.x}%`}
            cy={`${n.y}%`}
            r="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: `nodePing ${3 + (i % 3) * 0.5}s ${(i * 0.38) % 4}s ease-out infinite`,
            }}
          />
        ))}

        {NET_NODES.map((n, i) => (
          <circle
            key={`d${i}`}
            cx={`${n.x}%`}
            cy={`${n.y}%`}
            r={i % 4 === 0 ? 3 : i % 4 === 1 ? 2.5 : 2}
            fill="currentColor"
            style={{
              animation: `dotGlow 3s ${(i * 0.3) % 2.5}s ease-in-out infinite`,
            }}
          />
        ))}
      </svg>

      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          zIndex: 10,
          animation: "handCycle 5s cubic-bezier(0.4,0,0.6,1) infinite",
        }}
      >
        <LogoMark size={340} className="text-zinc-900" />
      </div>
    </div>
  );
}

export default function LoginBrandPanel() {
  return (
    <section className="hidden lg:flex w-1/2 bg-zinc-100 text-zinc-900 flex-col justify-between p-14 relative overflow-hidden">
      <style>{`
        @keyframes edgePulse {
          0%, 100% { stroke-opacity: 0.04; }
          50% { stroke-opacity: 0.22; }
        }

        @keyframes nodePing {
          0% { transform: scale(1); stroke-opacity: 0.5; }
          100% { transform: scale(6); stroke-opacity: 0; }
        }

        @keyframes dotGlow {
          0%, 100% { fill-opacity: 0.2; }
          50% { fill-opacity: 0.55; }
        }

        @keyframes handCycle {
          0%   { transform: rotate(0deg) scale(1); opacity: 0.82; }
          18%  { transform: rotate(-14deg) scale(1.13); opacity: 0.9; }
          38%  { transform: rotate(7deg) scale(0.91); opacity: 0.75; }
          62%  { transform: rotate(13deg) scale(1.1); opacity: 0.88; }
          82%  { transform: rotate(2deg) scale(1.03); opacity: 0.85; }
          100% { transform: rotate(0deg) scale(1); opacity: 0.82; }
        }
      `}</style>

      <LoginAnimation />

      <div className="relative z-10 flex justify-center w-full">
        <span className="text-lg font-black tracking-[0.18em] uppercase text-zinc-700">
          RenewalOps
        </span>
      </div>

      <p className="relative z-10 text-xs text-zinc-400">
        © 2026 RenewalOps — Mauritius
      </p>
    </section>
  );
}