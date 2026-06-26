"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Seal, companyMonogram } from "@/components/auth/seal";
import { PermissionGate } from "@/components/shell/permission-gate";
import { CompanyEditForm } from "@/components/company/company-edit-form";
import { useAuth } from "@/lib/auth/auth-context";
import { useCompany } from "@/lib/company/company-context";
import { ApiError } from "@/lib/api";
import { getCompany, type Address, type CompanyResponse } from "@/lib/data-api";

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

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CompanyInfoPage() {
  return (
    <PermissionGate anyPermission={["company:read"]}>
      <CompanyInfo />
    </PermissionGate>
  );
}

function CompanyInfo() {
  const router = useRouter();
  const { can } = useAuth();
  const { refresh: refreshShellCompany } = useCompany();
  const canManage = can("company:manage");
  const [data, setData] = useState<CompanyResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCompany().then(
      (d) => {
        if (!cancelled) {
          setData(d);
          setStatus("ready");
        }
      },
      (e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
          return;
        }
        setError(e instanceof ApiError ? e.message : "Failed to load company information.");
        setStatus("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [router]);

  const reload = useCallback(async () => {
    const d = await getCompany().catch(() => null);
    if (d) setData(d);
  }, []);

  if (status === "loading") return <StateNote>Loading company profile…</StateNote>;
  if (status === "error" || !data) return <StateNote tone="danger">{error || "Failed to load."}</StateNote>;

  if (editing) {
    return (
      <CompanyEditForm
        data={data}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void reload();
          void refreshShellCompany();
        }}
      />
    );
  }

  const { profile: p, memberships, activeSegments } = data;

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8 sm:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Seal size={64} aura monogram={companyMonogram(p.tradeName)} />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-oxblood">
              {ENTITY_LABEL[p.entityType ?? ""] ?? "Company"}
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
          {canManage ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-[6px] border border-rule-strong bg-paper-raised px-3.5 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-oxblood hover:text-oxblood"
            >
              Edit profile
            </button>
          ) : null}
          <div className="flex flex-wrap justify-end gap-1.5">
            {p.sebiRegNo ? <KeyChip k="SEBI" v={p.sebiRegNo} /> : null}
            {p.cin ? <KeyChip k="CIN" v={p.cin} /> : null}
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

      {/* Memberships */}
      <Panel title="Exchange Memberships" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-rule-strong font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                <Th>Exchange</Th>
                <Th>Type</Th>
                <Th>Trading Member ID</Th>
                <Th>Clearing</Th>
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
                  <Td>
                    <span className="flex flex-col gap-1">
                      <ModeChip self={m.clearingMode === "self"} selfLabel="Self-clearing" otherLabel="Third-party" />
                      <span className="font-mono text-[11px] text-ink-muted">
                        {m.clearingMode === "self"
                          ? m.clearingMemberId || m.cmCode || "—"
                          : `via ${m.thirdPartyClearer?.name ?? "—"}`}
                      </span>
                    </span>
                  </Td>
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
              {memberships.length === 0 ? (
                <tr>
                  <Td className="text-ink-muted">No memberships recorded.</Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Identity & Statutory">
          <DefGrid
            rows={[
              ["Legal name", p.legalName],
              ["Entity type", ENTITY_LABEL[p.entityType ?? ""] ?? p.entityType],
              ["Date of incorporation", fmtDate(p.dateOfIncorporation)],
              ["Founded", p.foundedYear ? String(p.foundedYear) : null],
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
              ["Compliance officer", joinPerson(p.complianceOfficer)],
              ["Principal officer", joinPerson(p.principalOfficer)],
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
              {p.keyPersonnel.length ? (
                p.keyPersonnel.map((k, i) => (
                  <tr key={k.din ?? i} className="border-b border-rule last:border-0">
                    <Td className="text-ink">{k.name}</Td>
                    <Td>{k.role ?? "—"}</Td>
                    <Td className="font-mono tabular-nums">{k.din ?? "—"}</Td>
                    <Td className="font-mono tabular-nums">{k.pan ?? "—"}</Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <Td className="text-ink-muted">None recorded.</Td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>

        <Panel title="Depository & Banking">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">Depository participation</p>
          <table className="mt-2 w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-rule font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                <Th>Depository</Th>
                <Th>Mode</Th>
                <Th>DP ID</Th>
                <Th>DP / Provider</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {p.depositories.length ? (
                p.depositories.map((d) => (
                  <tr key={d.depository} className="border-b border-rule last:border-0">
                    <Td className="font-medium text-ink">{d.depository}</Td>
                    <Td>
                      <ModeChip self={d.mode === "self"} selfLabel="Self DP" otherLabel="Third-party" />
                    </Td>
                    <Td className="font-mono tabular-nums">{d.dpId ?? "—"}</Td>
                    <Td>
                      {d.mode === "self" ? (
                        <span className="text-ink">{d.dpName ?? "Self"}</span>
                      ) : (
                        <span className="flex flex-col">
                          <span className="text-ink">via {d.thirdParty?.name ?? "—"}</span>
                          <span className="font-mono text-[10px] text-ink-muted/70">
                            {[d.thirdParty?.sebiRegNo, d.thirdParty?.email, d.thirdParty?.agreementRef]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      )}
                    </Td>
                    <Td>
                      {d.active ? (
                        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-forest">Active</span>
                      ) : (
                        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted/70">Inactive</span>
                      )}
                    </Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <Td className="text-ink-muted">None recorded.</Td>
                </tr>
              )}
            </tbody>
          </table>
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
              {p.bankAccounts.length ? (
                p.bankAccounts.map((b) => (
                  <tr key={b.accountNo} className="border-b border-rule last:border-0">
                    <Td className="text-ink">{b.label ?? "—"}</Td>
                    <Td>{b.bankName}</Td>
                    <Td className="font-mono tabular-nums">{b.accountNo}</Td>
                    <Td className="font-mono">{b.ifsc ?? "—"}</Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <Td className="text-ink-muted">None recorded.</Td>
                </tr>
              )}
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

      <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.14em] text-forest/70">
        Live · fetched from /api/v1/company
      </p>
    </div>
  );
}

/* ── Presentational helpers ─────────────────────────────────────────────────── */

function joinPerson(per: { name?: string; email?: string } | undefined) {
  if (!per || (!per.name && !per.email)) return null;
  return [per.name, per.email].filter(Boolean).join(" · ");
}

function StateNote({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "danger" }) {
  return (
    <div className="mx-auto max-w-[1180px] px-6 py-12 sm:px-8">
      <p className={`font-mono text-[12px] uppercase tracking-[0.16em] ${tone === "danger" ? "text-danger" : "text-ink-muted"}`}>
        {children}
        {tone === "muted" ? <span className="sb-caret ml-0.5 inline-block">▍</span> : null}
      </p>
    </div>
  );
}

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

function AddressBlock({ addr }: { addr: Address }) {
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

function ModeChip({ self, selfLabel, otherLabel }: { self: boolean; selfLabel: string; otherLabel: string }) {
  return self ? (
    <span className="inline-block rounded-[4px] border border-forest/30 bg-forest-tint px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.06em] text-forest">
      {selfLabel}
    </span>
  ) : (
    <span className="inline-block rounded-[4px] border border-gold/50 bg-paper px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.06em] text-gold">
      {otherLabel}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-2 text-left font-medium first:pl-0">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-2.5 align-top text-ink-muted first:pl-0 ${className}`}>{children}</td>;
}
