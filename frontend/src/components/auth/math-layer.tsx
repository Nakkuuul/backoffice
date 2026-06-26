/**
 * Mathematics illustrations for the ledger panel — a labelled Fibonacci-squares
 * tiling with its golden spiral, a sine/cosine wave, and faint engraved
 * formulas (φ, the Fibonacci sequence, Euler's identity). Pure deterministic
 * SVG/markup (no hydration mismatch); decorative (aria-hidden).
 */

const FIB = [1, 1, 2, 3, 5, 8, 13, 21];

interface Sq {
  x: number;
  y: number;
  s: number;
}

function buildFib(): { squares: Sq[]; minX: number; minY: number; w: number; h: number } {
  const squares: Sq[] = [{ x: 0, y: 0, s: FIB[0] }];
  let X = 0;
  let Y = 0;
  let W = FIB[0];
  let H = FIB[0];
  for (let i = 1; i < FIB.length; i += 1) {
    const s = FIB[i];
    const dir = (i - 1) % 4; // right, top, left, bottom (CCW)
    if (dir === 0) {
      squares.push({ x: X + W, y: Y, s });
      W += s;
    } else if (dir === 1) {
      squares.push({ x: X, y: Y - s, s });
      Y -= s;
      H += s;
    } else if (dir === 2) {
      squares.push({ x: X - s, y: Y, s });
      X -= s;
      W += s;
    } else {
      squares.push({ x: X, y: Y + H, s });
      H += s;
    }
  }
  return { squares, minX: X, minY: Y, w: W, h: H };
}

const FIBDATA = buildFib();

/** Quarter-circle arc inside a square → the continuous Fibonacci/golden spiral. */
function spiralPath(squares: Sq[]): string {
  let d = "";
  squares.forEach((sq, i) => {
    const dir = i === 0 ? 3 : (i - 1) % 4;
    // Center = the corner of the square pointing toward the spiral eye; arc
    // sweeps the opposite (outer) two corners.
    let cx = sq.x;
    let cy = sq.y;
    let from: [number, number] = [sq.x, sq.y];
    let to: [number, number] = [sq.x, sq.y];
    const s = sq.s;
    if (dir === 0) {
      // right square: eye corner = bottom-left
      cx = sq.x;
      cy = sq.y + s;
      from = [sq.x, sq.y];
      to = [sq.x + s, sq.y + s];
    } else if (dir === 1) {
      // top square: eye corner = bottom-left
      cx = sq.x;
      cy = sq.y + s;
      from = [sq.x + s, sq.y + s];
      to = [sq.x, sq.y];
    } else if (dir === 2) {
      // left square: eye corner = top-right
      cx = sq.x + s;
      cy = sq.y;
      from = [sq.x + s, sq.y + s];
      to = [sq.x, sq.y];
    } else {
      // bottom square: eye corner = top-right
      cx = sq.x + s;
      cy = sq.y;
      from = [sq.x, sq.y];
      to = [sq.x + s, sq.y + s];
    }
    if (i === 0) d += `M${from[0]} ${from[1]}`;
    // sweep=1 keeps the curve bowing away from the eye corner.
    d += `A${s} ${s} 0 0 1 ${to[0]} ${to[1]}`;
    void cx;
    void cy;
  });
  return d;
}

const SPIRAL = spiralPath(FIBDATA.squares);
const PAD = 1.5;
const VB = `${FIBDATA.minX - PAD} ${FIBDATA.minY - PAD} ${FIBDATA.w + PAD * 2} ${FIBDATA.h + PAD * 2}`;

// Sine + cosine over [0, 4π].
function wave(fn: (t: number) => number, amp: number, mid: number): string {
  let d = "";
  for (let i = 0; i <= 240; i += 1) {
    const x = (i / 240) * 720;
    const t = (i / 240) * Math.PI * 4;
    const y = mid - fn(t) * amp;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}
const SINE = wave(Math.sin, 26, 40);
const COSINE = wave(Math.cos, 26, 40);

export function MathLayer() {
  return (
    <>
      {/* Fibonacci squares + golden spiral (upper-right of the panel). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[6%] top-[12%] hidden w-[34%] max-w-[360px] xl:block"
      >
        <svg viewBox={VB} className="h-auto w-full" style={{ overflow: "visible" }}>
          {FIBDATA.squares.map((sq, i) => (
            <g key={i}>
              <rect
                x={sq.x}
                y={sq.y}
                width={sq.s}
                height={sq.s}
                fill="none"
                stroke="rgba(28,26,23,0.13)"
                strokeWidth={0.18}
              />
              <text
                x={sq.x + sq.s / 2}
                y={sq.y + sq.s / 2}
                fill="rgba(110,31,42,0.34)"
                fontSize={Math.min(sq.s * 0.42, 4)}
                fontFamily="var(--font-mono)"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {sq.s}
              </text>
            </g>
          ))}
          <path d={SPIRAL} fill="none" stroke="rgba(154,123,51,0.55)" strokeWidth={0.5} />
        </svg>
      </div>

      {/* Sine / cosine wave, low in the panel. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 bottom-[20%] hidden opacity-70 lg:block"
      >
        <svg viewBox="0 0 720 80" className="h-16 w-full" style={{ overflow: "visible" }}>
          <line x1="0" y1="40" x2="720" y2="40" stroke="rgba(28,26,23,0.10)" strokeWidth={0.5} />
          <path d={SINE} fill="none" stroke="rgba(110,31,42,0.28)" strokeWidth={1} />
          <path d={COSINE} fill="none" stroke="rgba(31,77,58,0.24)" strokeWidth={1} strokeDasharray="3 3" />
        </svg>
      </div>

      {/* Engraved formulas / sequence. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[7%] top-[8%] hidden font-mono text-[11px] tracking-[0.08em] text-ink-muted/55 xl:block"
      >
        φ = 1.61803398875
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[6%] top-[44%] hidden -rotate-90 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted/45 xl:block"
      >
        1·1·2·3·5·8·13·21·34·55·89·144
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[12%] left-12 hidden font-mono text-[11px] tracking-[0.06em] text-ink-muted/45 lg:block"
      >
        eⁱᵖ + 1 = 0 · ∑ 1/n² = π²/6
      </div>
    </>
  );
}
