/**
 * Decorative placeholder QR — a deterministic faux-QR matrix (finder patterns +
 * a fixed pseudo-random field) with a scanning line. It is NOT a real code; on
 * integration, render the backend's `qrCode` PNG data URL in an <img> instead.
 * Deterministic generation keeps SSR and client markup identical (no hydration
 * mismatch).
 */
const N = 25; // modules per side

function buildMatrix(): boolean[][] {
  let seed = 0x2f6e2b1;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const m: boolean[][] = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => rand() > 0.52),
  );

  const inFinder = (r: number, c: number) =>
    (r < 8 && c < 8) || (r < 8 && c >= N - 8) || (r >= N - 8 && c < 8);

  // Clear finder zones, then stamp the three 7x7 finder patterns.
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      if (inFinder(r, c)) m[r][c] = false;
    }
  }
  const stamp = (or: number, oc: number) => {
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        const ring = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        m[or + r][oc + c] = ring || core;
      }
    }
  };
  stamp(0, 0);
  stamp(0, N - 7);
  stamp(N - 7, 0);
  return m;
}

const MATRIX = buildMatrix();

export function QrPlaceholder({ size = 200, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[10px] border border-rule-strong bg-white p-3 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${N} ${N}`}
        width="100%"
        height="100%"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {MATRIX.flatMap((row, r) =>
          row.map((on, c) =>
            on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#1c1a17" /> : null,
          ),
        )}
      </svg>
      {/* Scanning line. */}
      <span
        aria-hidden="true"
        className="sb-qr-scan pointer-events-none absolute inset-x-2"
        style={{
          top: "4%",
          height: 2,
          background:
            "linear-gradient(90deg, transparent, rgba(201,168,106,0.9), transparent)",
          boxShadow: "0 0 8px rgba(201,168,106,0.6)",
        }}
      />
    </div>
  );
}
