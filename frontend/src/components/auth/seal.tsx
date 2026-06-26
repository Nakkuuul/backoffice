import type { CSSProperties } from "react";

interface SealProps {
  /** Diameter in pixels. 96 on the ledger panel, 56 on mobile. */
  size?: number;
  /** Drives the success / submit micro-animation (motion is reduced-motion gated). */
  state?: "idle" | "press" | "verified";
  /** Render a slowly-orbiting antique-brass aura ring (left-panel hero only). */
  aura?: boolean;
  /** Engraved monogram (1–2 chars). Defaults to "SB"; pass company initials on the dashboard. */
  monogram?: string;
  className?: string;
}

/** Derive a 1–2 char monogram from a company name ("Zerodha" → "ZE", "Sapphire Broking" → "SB"). */
export function companyMonogram(name?: string | null): string {
  if (!name?.trim()) return "SB";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

/**
 * Pure-CSS embossed registry seal. Decorative only (aria-hidden).
 * The "letterpress" feel comes from layered inset shadows (light top-left,
 * dark bottom-right), a low-opacity antique-brass rim, and a thin oxblood
 * inner hairline ring — no images, no glossy bevels.
 */
export function Seal({ size = 96, state = "idle", aura = false, monogram = "SB", className = "" }: SealProps) {
  const monogramSize = Math.round(size * 0.42);
  const ringSize = size + 22;

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

  const seal = (
    <div
      aria-hidden="true"
      className={`relative shrink-0 rounded-full ${
        state === "press" ? "sb-animate-seal-press" : ""
      } ${aura ? "" : className}`}
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
        <span style={monogramStyle}>{monogram}</span>
      </span>
    </div>
  );

  if (!aura) return seal;

  // Hero variant: a thin antique-brass arc slowly orbiting the seal.
  return (
    <div
      aria-hidden="true"
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="sb-seal-ring pointer-events-none absolute rounded-full"
        style={{
          width: ringSize,
          height: ringSize,
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(201,168,106,0) 40deg, rgba(201,168,106,0.65) 95deg, rgba(201,168,106,0) 150deg, transparent 210deg, rgba(110,31,42,0.3) 285deg, transparent 340deg)",
          WebkitMask:
            "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
        }}
      />
      {seal}
    </div>
  );
}
