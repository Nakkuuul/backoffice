/**
 * Guilloché rosette — the intricate engine-turned line-art found on banknotes
 * and share certificates. Pure deterministic SVG (identical on server + client,
 * no hydration mismatch); the layers slowly counter-rotate via CSS. Decorative.
 */
const C = 300; // center of the 600x600 viewBox

/** Rose curve r = A + B·cos(kθ) → a k-lobed lacework ring. */
function rosePath(A: number, B: number, k: number, steps = 900): string {
  let d = "";
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const r = A + B * Math.cos(k * t);
    const x = C + r * Math.cos(t);
    const y = C + r * Math.sin(t);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d}Z`;
}

/** Hypotrochoid (spirograph) — denser interlacing. */
function spiroPath(R: number, r: number, d: number, turns: number, steps = 1600): string {
  const ratio = (R - r) / r;
  let out = "";
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2 * turns;
    const x = C + (R - r) * Math.cos(t) + d * Math.cos(ratio * t);
    const y = C + (R - r) * Math.sin(t) - d * Math.sin(ratio * t);
    out += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return out;
}

const OXBLOOD = "rgba(110,31,42,";
const BRASS = "rgba(154,123,51,";
const INK = "rgba(28,26,23,";

const ticks = Array.from({ length: 120 }, (_, i) => {
  const a = (i / 120) * Math.PI * 2;
  const long = i % 5 === 0;
  const r1 = long ? 250 : 256;
  const r2 = 262;
  return {
    x1: C + r1 * Math.cos(a),
    y1: C + r1 * Math.sin(a),
    x2: C + r2 * Math.cos(a),
    y2: C + r2 * Math.sin(a),
    long,
  };
});

const spokes = Array.from({ length: 90 }, (_, i) => {
  const a = (i / 90) * Math.PI * 2;
  return { x: C + 235 * Math.cos(a), y: C + 235 * Math.sin(a) };
});

export function Guilloche({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 600"
      aria-hidden="true"
      className={className}
      style={{ overflow: "visible" }}
    >
      {/* Static instrument bezel: rings, ticks, fine engine-turned spokes. */}
      <g>
        {[96, 150, 232, 262].map((r) => (
          <circle key={r} cx={C} cy={C} r={r} fill="none" stroke={`${INK}0.10)`} strokeWidth={0.6} />
        ))}
        {spokes.map((s, i) => (
          <line
            key={i}
            x1={C}
            y1={C}
            x2={s.x}
            y2={s.y}
            stroke={`${INK}0.05)`}
            strokeWidth={0.4}
          />
        ))}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.long ? `${BRASS}0.5)` : `${INK}0.18)`}
            strokeWidth={t.long ? 1 : 0.6}
          />
        ))}
      </g>

      {/* Counter-rotating rosette layers. */}
      <g className="sb-spin-slow">
        <path d={rosePath(150, 86, 24)} fill="none" stroke={`${OXBLOOD}0.20)`} strokeWidth={0.7} />
      </g>
      <g className="sb-spin-rev">
        <path d={rosePath(120, 60, 40)} fill="none" stroke={`${BRASS}0.26)`} strokeWidth={0.6} />
      </g>
      <g className="sb-spin-med">
        <path d={rosePath(210, 34, 18)} fill="none" stroke={`${INK}0.16)`} strokeWidth={0.6} />
        <path d={spiroPath(220, 64, 96, 16)} fill="none" stroke={`${OXBLOOD}0.14)`} strokeWidth={0.5} />
      </g>
      <g className="sb-spin-slow">
        <path d={spiroPath(170, 50, 80, 10)} fill="none" stroke={`${BRASS}0.18)`} strokeWidth={0.5} />
      </g>
    </svg>
  );
}
