import { Seal } from "@/components/auth/seal";
import { PermissionGate } from "@/components/shell/permission-gate";

/* ──────────────────────────────────────────────────────────────────────────
 * MOCK — shaped exactly like GET /api/v1/company ({ profile, memberships,
 * activeSegments }). When integrating, replace COMPANY with a fetch through the
 * authenticated BFF; the rendering below stays unchanged.
 * ────────────────────────────────────────────────────────────────────────── */
const COMPANY = {
  profile: {
    tradeName: "Sapphire Broking",
    legalName: "Sapphire Broking Private Limited",
    entityType: "private_limited",
    dateOfIncorporation: "2019-06-12",
    foundedYear: 2019,
    cin: "U67120MH2019PTC123456",
    pan: "AABCS1234K",
    gstin: "27AABCS1234K1Z5",
    tan: "NGPS12345K",
    sebiRegNo: "INZ000312345",
    logoRef: null,
    registeredAddress: {
      line1: "4th Floor, Sapphire House",
      line2: "Wardha Road, Dhantoli",
      city: "Nagpur",
      state: "Maharashtra",
      pincode: "440012",
      country: "India",
    },
    headOfficeAddress: {
      line1: "Unit 1102, Trade Tower",
      line2: "Bandra Kurla Complex",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400051",
      country: "India",
    },
    phone: "+91 712 2999999",
    altPhone: "+91 712 2888888",
    email: "info@sapphirebroking.net",
    website: "https://sapphirebroking.net",
    supportEmail: "support@sapphirebroking.net",
    grievanceEmail: "grievance@sapphirebroking.net",
    complianceOfficer: { name: "Ananya Deshpande", email: "compliance@sapphirebroking.net", phone: "+91 98220 11111" },
    principalOfficer: { name: "Rohan Mehta", email: "principal@sapphirebroking.net", phone: "+91 98220 22222" },
    keyPersonnel: [
      { name: "Nakul Pratap Thakur", role: "Managing Director", din: "08123456", pan: "ABCPT1234M", email: "nakul@sapphirebroking.net", phone: "+91 98220 33333" },
      { name: "Priya Sharma", role: "Director", din: "08234567", pan: "ABCPS2345N", email: "priya@sapphirebroking.net", phone: "+91 98220 44444" },
    ],
    nsdlDpId: "IN303456",
    cdslDpId: "12088700",
    bankAccounts: [
      { label: "Client Settlement", bankName: "HDFC Bank", accountNo: "50200012345678", ifsc: "HDFC0000123", branch: "Dhantoli, Nagpur", type: "settlement" },
      { label: "Own / House", bankName: "ICICI Bank", accountNo: "002405001234", ifsc: "ICIC0000024", branch: "BKC, Mumbai", type: "own" },
    ],
    baseCurrency: "INR",
    financialYearStart: "04-01",
    timezone: "Asia/Kolkata",
    updatedAt: "2026-06-26T11:30:00.000Z",
  },
  memberships: [
    { id: 1, exchange: "NSE", membershipType: "TM-CM", tradingMemberId: "90123", clearingMemberId: "M51234", cmCode: "12345", registrationNo: "INB231234567", segments: ["CASH", "FNO", "CURRENCY"], active: true, effectiveFrom: "2019-08-01" },
    { id: 2, exchange: "BSE", membershipType: "TM-CM", tradingMemberId: "6789", clearingMemberId: "C6789", cmCode: "6789", registrationNo: "INB011234567", segments: ["CASH", "FNO"], active: true, effectiveFrom: "2019-09-15" },
    { id: 3, exchange: "MCX", membershipType: "TM", tradingMemberId: "55510", clearingMemberId: null, cmCode: null, registrationNo: "INZ000312345", segments: ["COMMODITY"], active: false, effectiveFrom: "2021-01-10" },
  ],
  activeSegments: ["CASH", "FNO", "CURRENCY"],
};

const ENTITY_LABEL: Record<string, string> = {
  proprietorship: "Proprietorship",
  partnership: "Partnership Firm",
  llp: "Limited Liability Partnership",
  private_limited: "Private Limited Company",
  public_limited: "Public Limited Company",
};
const SEGMENT_LABEL: Record<string, string> = {
  CASH: "Cash / Equity",
  FNO: "Futures & Options",
  CURRENCY: "Currency",
  COMMODITY: "Commodity",
  DEBT: "Debt",
  SLB: "SLB",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

type Addr = Partial<Record<"line1" | "line2" | "city" | "state" | "pincode" | "country", string>>;

export default function CompanyInfoPage() {
  return (
    <PermissionGate anyPermission={["company:read"]}>
      <CompanyInfo />
    </PermissionGate>
  );
}

function CompanyInfo() {
  const { profile: p, memberships, activeSegments } = COMPANY;

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8 sm:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Seal size={64} aura />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-oxblood">
              {ENTITY_LABEL[p.entityType] ?? "Company"}
            </p>
            <h1
              className="mt-1 text-[30px] leading-tight text-ink"
              style={{ fontFamily: "var(--font-display)", fontVariationSettings: "'opsz' 60, 'wght' 520" }}
            >
              {p.tradeName}
            </h1>
            <p className="mt-0.5 text-[14px] text-ink-muted">{p.legalName}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            disabled
            title="Editing arrives with API integration"
            className="cursor-not-allowed rounded-[6px] border border-rule-strong bg-paper-raised px-3.5 py-1.5 text-[13px] font-medium text-ink-muted opacity-70"
          >
            Edit profile
          </button>
          <div className="flex flex-wrap justify-end gap-1.5">
            <KeyChip k="SEBI" v={p.sebiRegNo} />
            <KeyChip k="CIN" v={p.cin} />
          </div>
        </div>
      </div>

      {/* Active segments */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-y border-rule py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">Active segments</span>
        {activeSegments.length ? (
          activeSegments.map((s) => (
            <span
              key={s}
              className="rounded-[5px] border border-forest/30 bg-forest-tint px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-forest"
            >
              {SEGMENT_LABEL[s] ?? s}
            </span>
          ))
        ) : (
          <span className="text-[13px] text-ink-muted">—</span>
        )}
      </div>

      {/* Memberships — the structured child data, given prominence. */}
      <Panel title="Exchange Memberships" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-rule-strong font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                <Th>Exchange</Th>
                <Th>Type</Th>
                <Th>Trading Member ID</Th>
                <Th>Clearing Member</Th>
                <Th>CM Code</Th>
                <Th>SEBI Reg.</Th>
                <Th>Segments</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.id} className="border-b border-rule last:border-0">
                  <Td className="font-medium text-ink">{m.exchange}</Td>
                  <Td>{m.membershipType ?? "—"}</Td>
                  <Td className="font-mono tabular-nums">{m.tradingMemberId ?? "—"}</Td>
                  <Td className="font-mono tabular-nums">{m.clearingMemberId ?? "—"}</Td>
                  <Td className="font-mono tabular-nums">{m.cmCode ?? "—"}</Td>
                  <Td className="font-mono tabular-nums">{m.registrationNo ?? "—"}</Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      {m.segments.map((s) => (
                        <span key={s} className="rounded-[3px] border border-rule bg-paper px-1.5 py-px font-mono text-[10px] text-ink-muted">
                          {s}
                        </span>
                      ))}
                    </span>
                  </Td>
                  <Td>
                    {m.active ? (
                      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-forest">Active</span>
                    ) : (
                      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted/70">Inactive</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Detail panels */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Identity & Statutory">
          <DefGrid
            rows={[
              ["Legal name", p.legalName],
              ["Entity type", ENTITY_LABEL[p.entityType] ?? p.entityType],
              ["Date of incorporation", fmtDate(p.dateOfIncorporation)],
              ["Founded", String(p.foundedYear)],
              ["CIN", p.cin],
              ["PAN", p.pan],
              ["GSTIN", p.gstin],
              ["TAN", p.tan],
              ["SEBI Reg. No.", p.sebiRegNo],
            ]}
          />
        </Panel>

        <Panel title="Contacts">
          <DefGrid
            rows={[
              ["Phone", p.phone],
              ["Alt. phone", p.altPhone],
              ["Email", p.email],
              ["Website", p.website],
              ["Support", p.supportEmail],
              ["Grievance", p.grievanceEmail],
            ]}
          />
        </Panel>

        <Panel title="Registered Office">
          <AddressBlock addr={p.registeredAddress} />
        </Panel>

        <Panel title="Head Office">
          <AddressBlock addr={p.headOfficeAddress} />
        </Panel>

        <Panel title="Compliance & Key Personnel">
          <DefGrid
            rows={[
              ["Compliance officer", `${p.complianceOfficer.name} · ${p.complianceOfficer.email}`],
              ["Principal officer", `${p.principalOfficer.name} · ${p.principalOfficer.email}`],
            ]}
          />
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">Directors / KMP</p>
          <table className="mt-2 w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-rule font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>DIN</Th>
                <Th>PAN</Th>
              </tr>
            </thead>
            <tbody>
              {p.keyPersonnel.map((k) => (
                <tr key={k.din} className="border-b border-rule last:border-0">
                  <Td className="text-ink">{k.name}</Td>
                  <Td>{k.role}</Td>
                  <Td className="font-mono tabular-nums">{k.din}</Td>
                  <Td className="font-mono tabular-nums">{k.pan}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Depository & Banking">
          <DefGrid
            rows={[
              ["NSDL DP ID", p.nsdlDpId],
              ["CDSL DP ID", p.cdslDpId],
            ]}
          />
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">Bank accounts</p>
          <table className="mt-2 w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-rule font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                <Th>Label</Th>
                <Th>Bank</Th>
                <Th>Account</Th>
                <Th>IFSC</Th>
              </tr>
            </thead>
            <tbody>
              {p.bankAccounts.map((b) => (
                <tr key={b.accountNo} className="border-b border-rule last:border-0">
                  <Td className="text-ink">{b.label}</Td>
                  <Td>{b.bankName}</Td>
                  <Td className="font-mono tabular-nums">{b.accountNo}</Td>
                  <Td className="font-mono">{b.ifsc}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Conventions">
          <DefGrid
            rows={[
              ["Base currency", p.baseCurrency],
              ["Financial year start", p.financialYearStart],
              ["Timezone", p.timezone],
              ["Last updated", fmtDate(p.updatedAt)],
            ]}
          />
        </Panel>
      </div>

      <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted/70">
        Showing sample data · not yet connected to the backend
      </p>
    </div>
  );
}

/* ── Presentational helpers ─────────────────────────────────────────────────── */

function Panel({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`overflow-hidden rounded-[10px] border border-rule bg-paper-raised ${className}`}>
      <header className="flex items-center gap-2 border-b border-rule px-4 py-2.5">
        <span aria-hidden="true" className="h-3 w-[3px] rounded-r bg-oxblood" />
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink">{title}</h2>
      </header>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

function DefGrid({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <dl className="grid grid-cols-[minmax(120px,38%)_1fr] gap-x-4 gap-y-2.5 text-[13.5px]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">{label}</dt>
          <dd className="break-words text-ink">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function AddressBlock({ addr }: { addr: Addr }) {
  const lines = [addr.line1, addr.line2, [addr.city, addr.state, addr.pincode].filter(Boolean).join(", "), addr.country].filter(Boolean);
  if (lines.length === 0) return <p className="text-[13.5px] text-ink-muted">—</p>;
  return (
    <address className="not-italic text-[14px] leading-relaxed text-ink">
      {lines.map((l, i) => (
        <span key={i} className="block">
          {l}
        </span>
      ))}
    </address>
  );
}

function KeyChip({ k, v }: { k: string; v: string }) {
  return (
    <span className="rounded-[5px] border border-rule bg-paper px-2 py-1 font-mono text-[10.5px] tracking-[0.04em] text-ink-muted">
      <span className="text-oxblood">{k}</span> <span className="text-ink">{v}</span>
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-2 text-left font-medium first:pl-0">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-2.5 align-top text-ink-muted first:pl-0 ${className}`}>{children}</td>;
}
