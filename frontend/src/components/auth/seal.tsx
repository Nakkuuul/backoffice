import type { CSSProperties } from "react";

interface SealProps {
  /** Diameter in pixels. 96 on the ledger panel, 56 on mobile. */
  size?: number;
  /** Drives the success / submit micro-animation (motion is reduced-motion gated). */
  state?: "idle" | "press" | "verified";
  className?: string;
}

/**
 * Pure-CSS embossed registry seal. Decorative only (aria-hidden).
 * The "letterpress" feel comes from layered inset shadows (light top-left,
 * dark bottom-right), a low-opacity antique-brass rim, and a thin oxblood
 * inner hairline ring — no images, no glossy bevels.
 */
export function Seal({ size = 96, state = "idle", className = "" }: SealProps) {
  const monogramSize = Math.round(size * 0.42);

  const sealStyle: CSSProperties = {
    width: size,
    height: size,
    background: "radial-gradient(circle at 38% 32%, #fdfbf6 0%, #efeadd 78%)",
    boxShadow: [
      "inset 2px 2px 4px rgba(255,255,255,0.9)",
      "inset -2px -2px 5px rgba(28,26,23,0.18)",
      "0 1px 1px rgba(28,26,23,0.06)",
    ].join(", "),
  };

  const monogramStyle: CSSProperties = {
    fontFamily: "var(--font-display)",
    fontVariationSettings: "'opsz' 40, 'wght' 560",
    fontSize: monogramSize,
    color: "var(--color-oxblood)",
    lineHeight: 1,
    textShadow:
      "0 1px 0 rgba(255,255,255,0.75), 0 -1px 0 rgba(28,26,23,0.22)",
  };

  return (
    <div
      aria-hidden="true"
      className={`relative shrink-0 rounded-full ${
        state === "press" ? "sb-animate-seal-press" : ""
      } ${className}`}
      style={sealStyle}
    >
      {/* Antique-brass rim (low opacity, never a fill). */}
      <span
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ boxShadow: "inset 0 0 0 1px rgba(154,123,51,0.45)" }}
      />
      {/* Oxblood inner hairline ring. */}
      <span
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: Math.round(size * 0.11),
          boxShadow: "inset 0 0 0 1px rgba(110,31,42,0.2)",
        }}
      />
      {/* Forest "verified" flash ring (gated under reduced-motion via parent classes). */}
      {state === "verified" ? (
        <span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ boxShadow: "inset 0 0 0 2px rgba(31,77,58,0.55)" }}
        />
      ) : null}
      {/* Monogram. */}
      <span className="absolute inset-0 flex items-center justify-center">
        <span style={monogramStyle}>SB</span>
      </span>
    </div>
  );
}
