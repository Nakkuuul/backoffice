"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Seal } from "@/components/auth/seal";
import { NavIcon } from "@/components/shell/icons";
import { PermissionGate } from "@/components/shell/permission-gate";
import { useAuth } from "@/lib/auth/auth-context";
import { useCompany } from "@/lib/company/company-context";
import { useVisibleNav, findLeaf } from "@/lib/nav/use-nav";
import type { NavSection, NavLeaf } from "@/lib/nav/manifest";

const ENTITY_LABEL: Record<string, string> = {
  proprietorship: "Proprietorship",
  partnership: "Partnership Firm",
  llp: "Limited Liability Partnership",
  private_limited: "Private Limited Company",
  public_limited: "Public Limited Company",
};

export default function AppCatchAll() {
  const pathname = usePathname();

  if (pathname === "/overview") return <Overview />;

  const found = findLeaf(pathname);
  if (!found) return <NotFound />;

  const guard = found.leaf?.anyPermission ?? found.section.anyPermission;
  return (
    <PermissionGate anyPermission={guard}>
      <ModulePlaceholder section={found.section} leaf={found.leaf} />
    </PermissionGate>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1100px] px-6 py-8 sm:px-8">{children}</div>;
}

function PageHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-oxblood">{kicker}</p>
      <h1
        className="mt-1.5 text-[30px] leading-tight text-ink"
        style={{ fontFamily: "var(--font-display)", fontVariationSettings: "'opsz' 60, 'wght' 500" }}
      >
        {title}
      </h1>
    </div>
  );
}

function Overview() {
  const { user, permissions } = useAuth();
  const { company } = useCompany();
  const visible = useVisibleNav();
  const launch = visible.filter((s) => s.key !== "overview");
  const firstName = user.fullName.split(/\s+/)[0] || user.fullName;

  return (
    <Shell>
      <PageHeader kicker={company ? company.tradeName : "Overview"} title={`Welcome, ${firstName}.`} />
      <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.12em] text-ink-muted">
        Signed in as {user.email} · {user.role}
        {user.twoFactorEnabled ? " · 2FA ✓" : ""}
      </p>

      {company ? (
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[9px] border border-rule bg-paper-raised px-4 py-3">
          <span
            className="text-[15px] text-ink"
            style={{ fontFamily: "var(--font-display)", fontVariationSettings: "'opsz' 30, 'wght' 520" }}
          >
            {company.tradeName}
          </span>
          {company.entityType ? (
            <span className="rounded-[5px] border border-rule bg-paper px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
              {ENTITY_LABEL[company.entityType] ?? company.entityType}
            </span>
          ) : null}
          {company.sebiRegNo ? (
            <span className="font-mono text-[11px] text-ink-muted">
              <span className="text-oxblood">SEBI</span> {company.sebiRegNo}
            </span>
          ) : null}
          <Link href="/masters/company-info" className="ml-auto font-mono text-[11px] uppercase tracking-[0.1em] text-oxblood hover:underline">
            Company Info →
          </Link>
        </div>
      ) : null}

      <div className="mt-4 h-px w-full bg-rule" />

      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
        Your registry · {launch.length} {launch.length === 1 ? "section" : "sections"} · {permissions.length} permissions
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {launch.map((section) => {
          const href = section.href ?? section.children?.[0]?.href ?? "/overview";
          const count = section.children?.length ?? 0;
          return (
            <Link
              key={section.key}
              href={href}
              className="group relative overflow-hidden rounded-[10px] border border-rule bg-paper-raised p-4 transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-oxblood/40 hover:shadow-[0_6px_18px_rgba(28,26,23,0.08)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gold/40" />
              <span className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-rule-strong bg-paper text-oxblood">
                <NavIcon name={section.icon} className="h-[18px] w-[18px]" />
              </span>
              <h2 className="mt-3 text-[16px] text-ink" style={{ fontFamily: "var(--font-display)", fontVariationSettings: "'opsz' 30, 'wght' 500" }}>
                {section.label}
              </h2>
              <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">
                {count > 0 ? `${count} ${count === 1 ? "view" : "views"}` : "Open"}
                <span className="ml-1 text-gold transition-transform group-hover:translate-x-0.5">→</span>
              </p>
            </Link>
          );
        })}
      </div>
    </Shell>
  );
}

function ModulePlaceholder({ section, leaf }: { section: NavSection; leaf?: NavLeaf }) {
  const title = leaf?.label ?? section.label;
  const guard = leaf?.anyPermission ?? section.anyPermission ?? [];
  const href = leaf?.href ?? section.href ?? "";

  return (
    <Shell>
      <div className="flex items-start justify-between gap-4">
        <PageHeader kicker={section.label} title={title} />
        {leaf?.soon ? (
          <span className="mt-2 shrink-0 rounded-[5px] border border-gold/50 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
            Coming soon
          </span>
        ) : null}
      </div>

      <div className="mt-4 h-px w-full bg-rule" />

      <div className="mt-8 flex flex-col items-center justify-center rounded-[12px] border border-dashed border-rule-strong bg-paper-raised/60 px-6 py-16 text-center">
        <Seal size={64} />
        <h3
          className="mt-6 text-[18px] text-ink"
          style={{ fontFamily: "var(--font-display)", fontVariationSettings: "'opsz' 30, 'wght' 500" }}
        >
          This ledger is being prepared.
        </h3>
        <p className="mt-1.5 max-w-sm text-[13.5px] text-ink-muted">
          The <span className="text-ink">{title}</span> workspace is scaffolded and access-controlled. Its
          interface lands in an upcoming release.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {href ? (
            <span className="rounded-[4px] border border-rule bg-paper px-2 py-1 font-mono text-[10.5px] text-ink-muted">
              {href}
            </span>
          ) : null}
          {guard.map((g) => (
            <span key={g} className="rounded-[4px] border border-rule bg-paper px-2 py-1 font-mono text-[10.5px] text-oxblood">
              {g}
            </span>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function NotFound() {
  return (
    <Shell>
      <PageHeader kicker="404" title="Page not found." />
      <p className="mt-2 text-[14px] text-ink-muted">
        That entry isn&rsquo;t in the registry.{" "}
        <Link href="/overview" className="text-oxblood hover:underline">
          Back to overview
        </Link>
        .
      </p>
    </Shell>
  );
}
