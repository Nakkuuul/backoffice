"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import {
  updateCompany,
  addMembership,
  updateMembership,
  deleteMembership,
  type Address,
  type BankAccount,
  type CompanyResponse,
  type Depository,
  type Kmp,
  type Membership,
  type Person,
} from "@/lib/data-api";

const ENTITY_TYPES: [string, string][] = [
  ["proprietorship", "Proprietorship"],
  ["partnership", "Partnership Firm"],
  ["llp", "LLP"],
  ["private_limited", "Private Limited"],
  ["public_limited", "Public Limited"],
];
const EXCHANGES = ["NSE", "BSE", "MCX", "NCDEX", "MSEI"];
const SEGMENTS = ["CASH", "FNO", "CURRENCY", "COMMODITY", "DEBT", "SLB"];
const MEMBERSHIP_TYPES = ["TM", "SCM", "PCM", "TM-CM"];
const DEPOSITORIES = ["NSDL", "CDSL"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Working copies use plain string-records for the nested third-party objects so
// the dynamic form inputs stay simple; payload builders convert them back.
type DepWork = Omit<Depository, "thirdParty"> & { thirdParty?: Record<string, string> };
type MemWork = Omit<Membership, "thirdPartyClearer"> & { _isNew?: boolean; thirdPartyClearer?: Record<string, string> };

export function CompanyEditForm({
  data,
  onCancel,
  onSaved,
}: {
  data: CompanyResponse;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [p, setP] = useState(() => structuredClone(data.profile));
  const [deps, setDeps] = useState<DepWork[]>(() => data.profile.depositories.map((d) => ({ ...d, thirdParty: rec(d.thirdParty) })));
  const [kmp, setKmp] = useState<Kmp[]>(() => data.profile.keyPersonnel.map((k) => ({ ...k })));
  const [banks, setBanks] = useState<BankAccount[]>(() => data.profile.bankAccounts.map((b) => ({ ...b })));
  const [members, setMembers] = useState<MemWork[]>(() => data.memberships.map((m) => ({ ...m, thirdPartyClearer: rec(m.thirdPartyClearer) })));
  const [removed, setRemoved] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (patchObj: Partial<typeof p>) => setP((prev) => ({ ...prev, ...patchObj }));
  const setAddr = (which: "registeredAddress" | "headOfficeAddress", k: string, v: string) =>
    setP((prev) => ({ ...prev, [which]: { ...prev[which], [k]: v } }));
  const setPerson = (which: "complianceOfficer" | "principalOfficer", k: string, v: string) =>
    setP((prev) => ({ ...prev, [which]: { ...prev[which], [k]: v } }));

  async function save() {
    setSaving(true);
    setError("");
    try {
      await updateCompany(buildProfile(p, deps, kmp, banks));
      for (const id of removed) await deleteMembership(id);
      for (const m of members) {
        const body = buildMembership(m);
        if (m._isNew) await addMembership(body);
        else await updateMembership(m.id, body);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8 sm:px-8">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-10 -mx-6 mb-6 flex items-center justify-between gap-4 border-b border-rule-strong bg-paper/90 px-6 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-oxblood">Editing · Company Info</p>
          <h1
            className="text-[20px] text-ink"
            style={{ fontFamily: "var(--font-display)", fontVariationSettings: "'opsz' 40, 'wght' 520" }}
          >
            {p.tradeName || "Company profile"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-[6px] border border-rule-strong bg-paper-raised px-3.5 py-1.5 text-[13px] font-medium text-ink-muted hover:text-ink disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-[6px] bg-oxblood px-4 py-1.5 text-[13px] font-medium text-on-accent hover:bg-oxblood-hover disabled:opacity-70"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-5 rounded-[6px] border border-danger/30 bg-oxblood-tint px-3.5 py-2.5 text-[13px] text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Identity & Statutory">
          <Grid>
            <Text label="Trade name" value={p.tradeName} onChange={(v) => set({ tradeName: v })} />
            <Text label="Legal name" value={p.legalName ?? ""} onChange={(v) => set({ legalName: v })} />
            <Select label="Entity type" value={p.entityType ?? ""} onChange={(v) => set({ entityType: v })} options={ENTITY_TYPES} allowEmpty />
            <Text label="Date of incorporation" value={p.dateOfIncorporation ?? ""} onChange={(v) => set({ dateOfIncorporation: v })} placeholder="YYYY-MM-DD" mono />
            <Text label="Founded year" value={p.foundedYear ? String(p.foundedYear) : ""} onChange={(v) => set({ foundedYear: v ? Number(v) : null })} mono />
            <Text label="CIN" value={p.cin ?? ""} onChange={(v) => set({ cin: v })} mono />
            <Text label="PAN" value={p.pan ?? ""} onChange={(v) => set({ pan: v })} mono />
            <Text label="GSTIN" value={p.gstin ?? ""} onChange={(v) => set({ gstin: v })} mono />
            <Text label="TAN" value={p.tan ?? ""} onChange={(v) => set({ tan: v })} mono />
            <Text label="SEBI Reg. No." value={p.sebiRegNo ?? ""} onChange={(v) => set({ sebiRegNo: v })} mono />
          </Grid>
        </Panel>

        <Panel title="Contacts">
          <Grid>
            <Text label="Phone" value={p.phone ?? ""} onChange={(v) => set({ phone: v })} />
            <Text label="Alt. phone" value={p.altPhone ?? ""} onChange={(v) => set({ altPhone: v })} />
            <Text label="Email" value={p.email ?? ""} onChange={(v) => set({ email: v })} />
            <Text label="Website" value={p.website ?? ""} onChange={(v) => set({ website: v })} />
            <Text label="Support email" value={p.supportEmail ?? ""} onChange={(v) => set({ supportEmail: v })} />
            <Text label="Grievance email" value={p.grievanceEmail ?? ""} onChange={(v) => set({ grievanceEmail: v })} />
          </Grid>
        </Panel>

        <Panel title="Registered Office">
          <AddressForm addr={p.registeredAddress} onChange={(k, v) => setAddr("registeredAddress", k, v)} />
        </Panel>
        <Panel title="Head Office">
          <AddressForm addr={p.headOfficeAddress} onChange={(k, v) => setAddr("headOfficeAddress", k, v)} />
        </Panel>

        <Panel title="Compliance Officers">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">Compliance officer</p>
          <Grid>
            <Text label="Name" value={p.complianceOfficer?.name ?? ""} onChange={(v) => setPerson("complianceOfficer", "name", v)} />
            <Text label="Email" value={p.complianceOfficer?.email ?? ""} onChange={(v) => setPerson("complianceOfficer", "email", v)} />
            <Text label="Phone" value={p.complianceOfficer?.phone ?? ""} onChange={(v) => setPerson("complianceOfficer", "phone", v)} />
          </Grid>
          <p className="mb-1 mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">Principal officer</p>
          <Grid>
            <Text label="Name" value={p.principalOfficer?.name ?? ""} onChange={(v) => setPerson("principalOfficer", "name", v)} />
            <Text label="Email" value={p.principalOfficer?.email ?? ""} onChange={(v) => setPerson("principalOfficer", "email", v)} />
            <Text label="Phone" value={p.principalOfficer?.phone ?? ""} onChange={(v) => setPerson("principalOfficer", "phone", v)} />
          </Grid>
        </Panel>

        <Panel title="Conventions">
          <Grid>
            <Text label="Base currency" value={p.baseCurrency ?? ""} onChange={(v) => set({ baseCurrency: v })} mono />
            <Text label="Financial year start" value={p.financialYearStart ?? ""} onChange={(v) => set({ financialYearStart: v })} placeholder="MM-DD" mono />
            <Text label="Timezone" value={p.timezone ?? ""} onChange={(v) => set({ timezone: v })} mono />
          </Grid>
        </Panel>
      </div>

      {/* Directors / KMP */}
      <Panel title="Directors / Key Personnel" className="mt-6">
        <ArrayEditor
          items={kmp}
          onAdd={() => setKmp((a) => [...a, { name: "" }])}
          onRemove={(i) => setKmp((a) => a.filter((_, idx) => idx !== i))}
          addLabel="Add person"
          render={(k, i) => (
            <Grid>
              <Text label="Name" value={k.name ?? ""} onChange={(v) => setKmp((a) => patch(a, i, { name: v }))} />
              <Text label="Role" value={k.role ?? ""} onChange={(v) => setKmp((a) => patch(a, i, { role: v }))} />
              <Text label="DIN" value={k.din ?? ""} onChange={(v) => setKmp((a) => patch(a, i, { din: v }))} mono />
              <Text label="PAN" value={k.pan ?? ""} onChange={(v) => setKmp((a) => patch(a, i, { pan: v }))} mono />
              <Text label="Email" value={k.email ?? ""} onChange={(v) => setKmp((a) => patch(a, i, { email: v }))} />
              <Text label="Phone" value={k.phone ?? ""} onChange={(v) => setKmp((a) => patch(a, i, { phone: v }))} />
            </Grid>
          )}
        />
      </Panel>

      {/* Depository participation (self vs third-party DP) */}
      <Panel title="Depository Participation" className="mt-6">
        <ArrayEditor
          items={deps}
          onAdd={() => setDeps((a) => [...a, { depository: "NSDL", mode: "self", active: true }])}
          onRemove={(i) => setDeps((a) => a.filter((_, idx) => idx !== i))}
          addLabel="Add depository"
          render={(d, i) => (
            <>
              <Grid>
                <Select label="Depository" value={d.depository} onChange={(v) => setDeps((a) => patch(a, i, { depository: v }))} options={DEPOSITORIES} />
                <Select label="Mode" value={d.mode} onChange={(v) => setDeps((a) => patch(a, i, { mode: v as Depository["mode"] }))} options={[["self", "Self DP"], ["third_party", "Third-party"]]} />
                <Text label="DP ID" value={d.dpId ?? ""} onChange={(v) => setDeps((a) => patch(a, i, { dpId: v }))} mono />
                <Text label="DP name" value={d.dpName ?? ""} onChange={(v) => setDeps((a) => patch(a, i, { dpName: v }))} />
                <Text label="SEBI Reg." value={d.sebiRegNo ?? ""} onChange={(v) => setDeps((a) => patch(a, i, { sebiRegNo: v }))} mono />
                <Check label="Active" checked={d.active !== false} onChange={(v) => setDeps((a) => patch(a, i, { active: v }))} />
              </Grid>
              {d.mode === "third_party" ? (
                <ThirdParty
                  title="Third-party DP details"
                  obj={d.thirdParty ?? {}}
                  idLabel="DP ID"
                  idKey="dpId"
                  onChange={(tp) => setDeps((a) => patch(a, i, { thirdParty: tp }))}
                />
              ) : null}
            </>
          )}
        />
      </Panel>

      {/* Bank accounts */}
      <Panel title="Bank Accounts" className="mt-6">
        <ArrayEditor
          items={banks}
          onAdd={() => setBanks((a) => [...a, { bankName: "", accountNo: "" }])}
          onRemove={(i) => setBanks((a) => a.filter((_, idx) => idx !== i))}
          addLabel="Add account"
          render={(b, i) => (
            <Grid>
              <Text label="Label" value={b.label ?? ""} onChange={(v) => setBanks((a) => patch(a, i, { label: v }))} />
              <Text label="Bank name" value={b.bankName ?? ""} onChange={(v) => setBanks((a) => patch(a, i, { bankName: v }))} />
              <Text label="Account no." value={b.accountNo ?? ""} onChange={(v) => setBanks((a) => patch(a, i, { accountNo: v }))} mono />
              <Text label="IFSC" value={b.ifsc ?? ""} onChange={(v) => setBanks((a) => patch(a, i, { ifsc: v }))} mono />
              <Text label="Branch" value={b.branch ?? ""} onChange={(v) => setBanks((a) => patch(a, i, { branch: v }))} />
              <Select label="Type" value={b.type ?? ""} onChange={(v) => setBanks((a) => patch(a, i, { type: v }))} options={[["own", "Own"], ["settlement", "Settlement"], ["client", "Client"], ["pool", "Pool"]]} allowEmpty />
            </Grid>
          )}
        />
      </Panel>

      {/* Exchange memberships (self vs third-party clearing) */}
      <Panel title="Exchange Memberships" className="mt-6">
        <ArrayEditor
          items={members}
          onAdd={() => setMembers((a) => [...a, { _isNew: true, id: 0, exchange: "NSE", clearingMode: "self", segments: [], active: true }])}
          onRemove={(i) =>
            setMembers((a) => {
              const m = a[i];
              if (!m._isNew) setRemoved((r) => [...r, m.id]);
              return a.filter((_, idx) => idx !== i);
            })
          }
          addLabel="Add membership"
          render={(m, i) => (
            <>
              <Grid>
                <Select label="Exchange" value={m.exchange} onChange={(v) => setMembers((a) => patch(a, i, { exchange: v }))} options={EXCHANGES} />
                <Select label="Membership type" value={m.membershipType ?? ""} onChange={(v) => setMembers((a) => patch(a, i, { membershipType: v }))} options={MEMBERSHIP_TYPES} allowEmpty />
                <Text label="Trading Member ID" value={m.tradingMemberId ?? ""} onChange={(v) => setMembers((a) => patch(a, i, { tradingMemberId: v }))} mono />
                <Text label="SEBI Reg." value={m.registrationNo ?? ""} onChange={(v) => setMembers((a) => patch(a, i, { registrationNo: v }))} mono />
                <Select label="Clearing mode" value={m.clearingMode ?? "self"} onChange={(v) => setMembers((a) => patch(a, i, { clearingMode: v as Membership["clearingMode"] }))} options={[["self", "Self-clearing"], ["third_party", "Third-party"]]} />
                <Check label="Active" checked={m.active !== false} onChange={(v) => setMembers((a) => patch(a, i, { active: v }))} />
              </Grid>
              {m.clearingMode === "self" ? (
                <Grid className="mt-3">
                  <Text label="Clearing Member ID" value={m.clearingMemberId ?? ""} onChange={(v) => setMembers((a) => patch(a, i, { clearingMemberId: v }))} mono />
                  <Text label="CM Code" value={m.cmCode ?? ""} onChange={(v) => setMembers((a) => patch(a, i, { cmCode: v }))} mono />
                </Grid>
              ) : (
                <ThirdParty
                  title="Third-party clearing member"
                  obj={m.thirdPartyClearer ?? {}}
                  idLabel="CM Code"
                  idKey="cmCode"
                  onChange={(tp) => setMembers((a) => patch(a, i, { thirdPartyClearer: tp }))}
                />
              )}
              <div className="mt-3">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">Segments</span>
                <div className="flex flex-wrap gap-2">
                  {SEGMENTS.map((s) => {
                    const on = (m.segments ?? []).includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          setMembers((a) =>
                            patch(a, i, { segments: on ? m.segments.filter((x) => x !== s) : [...(m.segments ?? []), s] }),
                          )
                        }
                        className={`rounded-[5px] border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors ${
                          on ? "border-oxblood bg-oxblood-tint text-oxblood" : "border-rule bg-paper text-ink-muted hover:border-oxblood/40"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        />
      </Panel>
    </div>
  );
}

/* ── Payload builders (satisfy the backend Zod schemas) ──────────────────────── */

function str(v: unknown) {
  return typeof v === "string" ? v : "";
}
function rec(o: unknown): Record<string, string> {
  const src = (o ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of Object.keys(src)) out[k] = str(src[k]);
  return out;
}
function cleanThirdParty(tp: Record<string, string> | undefined, idKeys: string[]) {
  const src = tp ?? {};
  const keys = ["name", ...idKeys, "sebiRegNo", "contactPerson", "email", "phone", "agreementRef"];
  const out: Record<string, string> = {};
  for (const k of keys) if (src[k] !== undefined) out[k] = str(src[k]);
  return out;
}
function addr(a: Partial<Address> = {}) {
  return { line1: str(a.line1), line2: str(a.line2), city: str(a.city), state: str(a.state), pincode: str(a.pincode), country: str(a.country) };
}
function person(per: Partial<Person> = {}) {
  return { name: str(per.name), email: str(per.email), phone: str(per.phone) };
}

function buildProfile(p: CompanyResponse["profile"], deps: DepWork[], kmp: Kmp[], banks: BankAccount[]) {
  const out: Record<string, unknown> = {
    tradeName: str(p.tradeName),
    legalName: str(p.legalName),
    cin: str(p.cin),
    pan: str(p.pan),
    gstin: str(p.gstin),
    tan: str(p.tan),
    sebiRegNo: str(p.sebiRegNo),
    phone: str(p.phone),
    altPhone: str(p.altPhone),
    email: str(p.email),
    website: str(p.website),
    supportEmail: str(p.supportEmail),
    grievanceEmail: str(p.grievanceEmail),
    baseCurrency: str(p.baseCurrency) || "INR",
    timezone: str(p.timezone) || "Asia/Kolkata",
    registeredAddress: addr(p.registeredAddress),
    headOfficeAddress: addr(p.headOfficeAddress),
    complianceOfficer: person(p.complianceOfficer),
    principalOfficer: person(p.principalOfficer),
    keyPersonnel: kmp
      .filter((k) => str(k.name).trim())
      .map((k) => ({ name: str(k.name), role: str(k.role), din: str(k.din), pan: str(k.pan), email: str(k.email), phone: str(k.phone) })),
    bankAccounts: banks
      .filter((b) => str(b.bankName).trim() && str(b.accountNo).trim())
      .map((b) => {
        const o: Record<string, string> = { bankName: str(b.bankName), accountNo: str(b.accountNo), label: str(b.label), ifsc: str(b.ifsc), branch: str(b.branch) };
        if (b.type) o.type = b.type;
        return o;
      }),
    depositories: deps
      .filter((d) => d.depository && d.mode)
      .map((d) => {
        const o: Record<string, unknown> = { depository: d.depository, mode: d.mode, dpId: str(d.dpId), dpName: str(d.dpName), sebiRegNo: str(d.sebiRegNo), active: d.active !== false };
        if (d.mode === "third_party") o.thirdParty = cleanThirdParty(d.thirdParty, ["dpId"]);
        return o;
      }),
  };
  if (p.entityType) out.entityType = p.entityType;
  if (str(p.financialYearStart)) out.financialYearStart = str(p.financialYearStart);
  if (DATE_RE.test(str(p.dateOfIncorporation))) out.dateOfIncorporation = str(p.dateOfIncorporation);
  if (p.foundedYear && Number.isFinite(Number(p.foundedYear))) out.foundedYear = Number(p.foundedYear);
  return out;
}

function buildMembership(m: MemWork) {
  const out: Record<string, unknown> = {
    exchange: m.exchange,
    tradingMemberId: str(m.tradingMemberId),
    clearingMode: m.clearingMode ?? "self",
    clearingMemberId: str(m.clearingMemberId),
    cmCode: str(m.cmCode),
    registrationNo: str(m.registrationNo),
    segments: m.segments ?? [],
    active: m.active !== false,
  };
  if (m.membershipType) out.membershipType = m.membershipType;
  if (DATE_RE.test(str(m.effectiveFrom))) out.effectiveFrom = str(m.effectiveFrom);
  if (m.clearingMode === "third_party") out.thirdPartyClearer = cleanThirdParty(m.thirdPartyClearer, ["clearingMemberId", "cmCode"]);
  return out;
}

/* ── Primitives ──────────────────────────────────────────────────────────────── */

function patch<T>(arr: T[], i: number, p: Partial<T>): T[] {
  return arr.map((it, idx) => (idx === i ? { ...it, ...p } : it));
}

const inputCls =
  "h-9 w-full rounded-[6px] border border-field-border bg-field px-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-oxblood";
const labelCls = "mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted";

function Grid({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 ${className}`}>{children}</div>;
}

function Text({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} ${mono ? "font-mono" : ""}`}
        spellCheck={false}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  allowEmpty,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[] | [string, string][];
  allowEmpty?: boolean;
}) {
  const opts = options.map((o) => (Array.isArray(o) ? o : [o, o])) as [string, string][];
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {allowEmpty ? <option value="">—</option> : null}
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-end gap-2 pb-1.5 text-[13px] text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-oxblood" />
      {label}
    </label>
  );
}

function AddressForm({ addr: a, onChange }: { addr: Address; onChange: (k: string, v: string) => void }) {
  return (
    <Grid>
      <Text label="Line 1" value={a.line1 ?? ""} onChange={(v) => onChange("line1", v)} />
      <Text label="Line 2" value={a.line2 ?? ""} onChange={(v) => onChange("line2", v)} />
      <Text label="City" value={a.city ?? ""} onChange={(v) => onChange("city", v)} />
      <Text label="State" value={a.state ?? ""} onChange={(v) => onChange("state", v)} />
      <Text label="Pincode" value={a.pincode ?? ""} onChange={(v) => onChange("pincode", v)} mono />
      <Text label="Country" value={a.country ?? ""} onChange={(v) => onChange("country", v)} />
    </Grid>
  );
}

function ThirdParty({
  title,
  obj,
  idLabel,
  idKey,
  onChange,
}: {
  title: string;
  obj: Record<string, string>;
  idLabel: string;
  idKey: string;
  onChange: (next: Record<string, string>) => void;
}) {
  const upd = (k: string, v: string) => onChange({ ...obj, [k]: v });
  return (
    <div className="mt-3 rounded-[8px] border border-dashed border-rule-strong bg-paper/60 p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-gold">{title}</p>
      <Grid>
        <Text label="Provider name" value={obj.name ?? ""} onChange={(v) => upd("name", v)} />
        <Text label={idLabel} value={obj[idKey] ?? ""} onChange={(v) => upd(idKey, v)} mono />
        <Text label="SEBI Reg." value={obj.sebiRegNo ?? ""} onChange={(v) => upd("sebiRegNo", v)} mono />
        <Text label="Contact person" value={obj.contactPerson ?? ""} onChange={(v) => upd("contactPerson", v)} />
        <Text label="Email" value={obj.email ?? ""} onChange={(v) => upd("email", v)} />
        <Text label="Phone" value={obj.phone ?? ""} onChange={(v) => upd("phone", v)} />
        <Text label="Agreement ref." value={obj.agreementRef ?? ""} onChange={(v) => upd("agreementRef", v)} mono />
      </Grid>
    </div>
  );
}

function ArrayEditor<T>({
  items,
  onAdd,
  onRemove,
  render,
  addLabel,
}: {
  items: T[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  render: (item: T, i: number) => React.ReactNode;
  addLabel: string;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="relative rounded-[8px] border border-rule bg-paper p-3.5">
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute right-3 top-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted hover:text-danger"
          >
            Remove
          </button>
          {render(item, i)}
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="rounded-[6px] border border-dashed border-rule-strong px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-oxblood hover:bg-oxblood-tint"
      >
        + {addLabel}
      </button>
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
