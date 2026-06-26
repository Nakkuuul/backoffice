/**
 * "Reports & calculations" backdrop for the ledger panel — an engraved tapestry
 * of report tables (trial balance / P&L / balance sheet), financial charts (NAV
 * line, candlesticks, segment bars, allocation donut), a live ticker, and a wall
 * of finance/maths formulas. Conveys that the backoffice runs the reports and
 * all the numbers. Pure deterministic markup; faint; decorative (aria-hidden).
 */

interface Row {
  label: string;
  dr: string;
  cr: string;
}

function ReportTable({
  title,
  rows,
  total,
  className = "",
}: {
  title: string;
  rows: Row[];
  total: string;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute font-mono text-ink-muted/45 ${className}`}>
      <div className="mb-1 flex items-center justify-between border-b border-ink/15 pb-1 text-[10px] uppercase tracking-[0.14em]">
        <span>{title}</span>
        <span className="text-ink-muted/35">₹ &apos;000</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-[10.5px] leading-[1.7]">
        <span className="text-ink-muted/35">Particulars</span>
        <span className="text-right text-ink-muted/35">Dr</span>
        <span className="text-right text-ink-muted/35">Cr</span>
        {rows.map((r) => (
          <span key={r.label} className="contents">
            <span className="truncate">{r.label}</span>
            <span className="text-right tabular-nums">{r.dr}</span>
            <span className="text-right tabular-nums">{r.cr}</span>
          </span>
        ))}
      </div>
      <div className="mt-1 flex items-center justify-between border-t border-double border-ink/20 pt-1 text-[10.5px] tabular-nums">
        <span className="uppercase tracking-[0.1em] text-ink-muted/40">Total</span>
        <span>{total}</span>
      </div>
    </div>
  );
}

const NAV = [18, 22, 19, 27, 31, 26, 34, 38, 33, 41, 46, 44, 52, 58, 55, 63];
function navPath(area = false): string {
  const W = 200;
  const H = 70;
  const step = W / (NAV.length - 1);
  let d = NAV.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${(H - (v / 70) * H).toFixed(1)}`).join("");
  if (area) d += `L${W} ${H}L0 ${H}Z`;
  return d;
}

const CANDLES: Array<[number, number, number, number]> = [
  [10, 16, 18, 8], [16, 13, 19, 11], [13, 21, 23, 12], [21, 19, 24, 17], [19, 26, 28, 18],
  [26, 24, 29, 22], [24, 31, 33, 23], [31, 35, 37, 30], [35, 30, 38, 29], [30, 37, 39, 28],
];

const BARS = [22, 34, 28, 41, 37, 48, 44, 56];

const DONUT_C = 2 * Math.PI * 40; // donut circumference
const DONUT = (() => {
  let off = 0;
  return [
    { frac: 0.38, color: "rgba(110,31,42,0.5)" },
    { frac: 0.27, color: "rgba(154,123,51,0.55)" },
    { frac: 0.2, color: "rgba(31,77,58,0.5)" },
    { frac: 0.15, color: "rgba(28,26,23,0.3)" },
  ].map((s) => {
    const len = s.frac * DONUT_C;
    const seg = { ...s, len, off };
    off += len;
    return seg;
  });
})();

const TICKER = [
  ["NIFTY 50", "+0.82%", true],
  ["SENSEX", "+0.61%", true],
  ["BANKNIFTY", "−0.24%", false],
  ["USD/INR", "−0.14%", false],
  ["GOLD", "+1.20%", true],
  ["INFY", "+2.10%", true],
  ["TCS", "−0.45%", false],
] as const;

function Formula({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute font-mono tracking-[0.03em] text-ink-muted/40 ${className}`}
    >
      {children}
    </div>
  );
}

export function LedgerBackdrop() {
  return (
    <>
      {/* ── Report tables ─────────────────────────────────────────────────── */}
      <ReportTable
        className="top-[6.5%] left-[34%] hidden w-[31%] xl:block"
        title="Trial Balance"
        rows={[
          { label: "Client Funds A/c", dr: "—", cr: "84,120.50" },
          { label: "Brokerage Income", dr: "—", cr: "12,408.75" },
          { label: "Settlement Dues", dr: "9,330.00", cr: "—" },
          { label: "Exchange Margin", dr: "61,250.00", cr: "—" },
          { label: "GST Payable", dr: "—", cr: "2,233.58" },
          { label: "Bank — HDFC", dr: "28,182.83", cr: "—" },
        ]}
        total="98,762.83"
      />
      <ReportTable
        className="top-[7%] right-[5%] hidden w-[22%] 2xl:block"
        title="Balance Sheet"
        rows={[
          { label: "Fixed Assets", dr: "42,900", cr: "—" },
          { label: "Investments", dr: "63,150", cr: "—" },
          { label: "Reserves", dr: "—", cr: "58,420" },
          { label: "Borrowings", dr: "—", cr: "47,630" },
        ]}
        total="1,06,050"
      />
      <ReportTable
        className="bottom-[8.5%] right-[5%] hidden w-[24%] xl:block"
        title="Profit & Loss"
        rows={[
          { label: "Brokerage", dr: "—", cr: "12,408" },
          { label: "Interest", dr: "—", cr: "3,902" },
          { label: "Operating Exp.", dr: "5,540", cr: "—" },
          { label: "Depreciation", dr: "612", cr: "—" },
        ]}
        total="10,158"
      />

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      {/* NAV area + line. */}
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[25%] left-12 hidden w-[28%] xl:block">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted/40">
          NAV · ₹ Cr · trailing 16
        </p>
        <svg viewBox="0 0 200 70" className="h-16 w-full" style={{ overflow: "visible" }}>
          {[0, 23.3, 46.6, 70].map((y) => (
            <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="rgba(28,26,23,0.06)" strokeWidth={0.4} />
          ))}
          <path d={navPath(true)} fill="rgba(110,31,42,0.05)" />
          <path d={navPath(false)} fill="none" stroke="rgba(110,31,42,0.40)" strokeWidth={1} />
        </svg>
      </div>

      {/* Candlesticks. */}
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[43%] right-[8%] hidden w-[22%] xl:block">
        <svg viewBox="0 0 200 60" className="h-14 w-full" style={{ overflow: "visible" }}>
          {CANDLES.map((c, i) => {
            const [o, cl, hi, lo] = c;
            const x = 8 + i * 19;
            const sc = (v: number) => 58 - (v / 42) * 56;
            const up = cl >= o;
            const col = up ? "rgba(31,77,58,0.5)" : "rgba(110,31,42,0.5)";
            return (
              <g key={i} stroke={col} fill={col}>
                <line x1={x} y1={sc(hi)} x2={x} y2={sc(lo)} strokeWidth={0.7} />
                <rect
                  x={x - 4}
                  y={sc(Math.max(o, cl))}
                  width={8}
                  height={Math.max(1.5, Math.abs(sc(o) - sc(cl)))}
                  fillOpacity={up ? 0.18 : 0.3}
                  strokeWidth={0.7}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Segment-turnover bars. */}
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[10%] left-[34%] hidden w-[20%] 2xl:block">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted/40">Segment turnover</p>
        <svg viewBox="0 0 160 60" className="h-14 w-full" style={{ overflow: "visible" }}>
          {BARS.map((h, i) => (
            <rect
              key={i}
              x={i * 20 + 2}
              y={60 - h}
              width={13}
              height={h}
              fill="rgba(154,123,51,0.28)"
              stroke="rgba(154,123,51,0.5)"
              strokeWidth={0.5}
            />
          ))}
        </svg>
      </div>

      {/* Allocation donut. */}
      <div aria-hidden="true" className="pointer-events-none absolute top-[39%] right-[7%] hidden 2xl:block">
        <svg viewBox="0 0 100 100" className="h-24 w-24" style={{ overflow: "visible" }}>
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(28,26,23,0.08)" strokeWidth="9" />
          {DONUT.map((seg, i) => (
            <circle
              key={i}
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={seg.color}
              strokeWidth="9"
              strokeDasharray={`${seg.len} ${DONUT_C - seg.len}`}
              strokeDashoffset={-seg.off}
              transform="rotate(-90 50 50)"
            />
          ))}
          <text x="50" y="52" textAnchor="middle" fill="rgba(110,31,42,0.4)" fontSize="9" fontFamily="var(--font-mono)">
            ALLOC
          </text>
        </svg>
      </div>

      {/* Ticker tape. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[58%] right-[6%] hidden space-y-0.5 font-mono text-[10px] 2xl:block"
      >
        {TICKER.map(([sym, chg, up]) => (
          <div key={sym} className="flex w-36 items-center justify-between">
            <span className="text-ink-muted/45">{sym}</span>
            <span className={up ? "text-forest/55" : "text-oxblood/55"}>{chg}</span>
          </div>
        ))}
      </div>

      {/* ── Calculation formulas (the "maths" wall) ───────────────────────── */}
      <Formula className="top-[24%] left-[34%] hidden text-[11px] xl:block">
        A = P(1 + r/n)<sup>nt</sup>
      </Formula>
      <Formula className="top-[60%] left-[35%] hidden text-[11px] xl:block">
        σ = √( Σ(xᵢ − x̄)² / n )
      </Formula>
      <Formula className="top-[68%] left-[34%] hidden text-[11px] 2xl:block">
        PV = FV / (1 + r)<sup>n</sup> · Sharpe = (Rₚ − R_f)/σₚ
      </Formula>
      <Formula className="top-[33%] left-[33%] hidden text-[11px] 2xl:block">
        d₁ = [ ln(S/K) + (r + σ²/2)T ] / (σ√T)
      </Formula>
      <Formula className="top-[52%] right-[8%] hidden text-[11px] 2xl:block">
        det [ a b ; c d ] = ad − bc
      </Formula>
      <Formula className="top-[30%] left-[31%] hidden text-[18px] leading-none text-ink-muted/25 xl:block">
        ∫ ∑ ∂ Δ √ π ₹ %
      </Formula>

      {/* Balance-sheet identity, set low and wide. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[19%] left-[34%] hidden font-mono text-[12px] uppercase tracking-[0.28em] text-ink-muted/30 xl:block"
      >
        Assets = Liabilities + Equity
      </div>
    </>
  );
}
