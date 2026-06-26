"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { canAny } from "@/lib/auth/permissions";
import { NAV, type NavSection, type NavLeaf } from "./manifest";

/** The manifest pruned to what the current user may see (sections with no
 *  surviving children are dropped — which also hides their domain name).
 *  Cheap to recompute; permissions are stable for the session. */
export function useVisibleNav(): NavSection[] {
  const { permissions } = useAuth();
  return useMemo(() => {
    const allow = (needs?: string[]) => canAny(permissions, needs ?? []);
    const out: NavSection[] = [];
    for (const section of NAV) {
      if (!section.children) {
        if (allow(section.anyPermission)) out.push(section);
        continue;
      }
      const children = section.children.filter((c) => allow(c.anyPermission));
      if (children.length > 0) out.push({ ...section, children });
    }
    return out;
  }, [permissions]);
}

export interface ActiveNav {
  sectionKey: string | null;
  leafHref: string | null;
  crumb: { section?: string; leaf?: string };
}

/** Longest-prefix match of the current path to a nav leaf/section. */
export function useActiveNav(visible: NavSection[]): ActiveNav {
  const pathname = usePathname();
  return useMemo(() => {
    let best: { len: number; sectionKey: string; href: string; section: string; leaf?: string } | null = null;
    const consider = (len: number, sectionKey: string, href: string, section: string, leaf?: string) => {
      if (len > 0 && (!best || len > best.len)) best = { len, sectionKey, href, section, leaf };
    };
    const matches = (href: string) => pathname === href || pathname.startsWith(href + "/");

    for (const s of visible) {
      if (s.href && matches(s.href)) consider(s.href.length, s.key, s.href, s.label);
      for (const c of s.children ?? []) {
        if (matches(c.href)) consider(c.href.length, s.key, c.href, s.label, c.label);
      }
    }
    if (!best) return { sectionKey: null, leafHref: null, crumb: {} };
    const b = best as { sectionKey: string; href: string; section: string; leaf?: string };
    return { sectionKey: b.sectionKey, leafHref: b.href, crumb: { section: b.section, leaf: b.leaf } };
  }, [pathname, visible]);
}

export interface PaletteItem {
  label: string;
  section: string;
  href: string;
  soon?: boolean;
}

/** Flatten the visible nav into command-palette destinations. */
export function flattenNav(visible: NavSection[]): PaletteItem[] {
  const items: PaletteItem[] = [];
  for (const s of visible) {
    if (s.href && !s.children) items.push({ label: s.label, section: s.label, href: s.href });
    for (const c of s.children ?? []) {
      items.push({ label: c.label, section: s.label, href: c.href, soon: c.soon });
    }
  }
  return items;
}

/** Find the manifest leaf for an arbitrary path (used by placeholder pages). */
export function findLeaf(pathname: string): { section: NavSection; leaf?: NavLeaf } | null {
  let best: { len: number; section: NavSection; leaf?: NavLeaf } | null = null;
  const matches = (href: string) => pathname === href || pathname.startsWith(href + "/");
  for (const s of NAV) {
    if (s.href && matches(s.href) && (!best || s.href.length > best.len)) best = { len: s.href.length, section: s };
    for (const c of s.children ?? []) {
      if (matches(c.href) && (!best || c.href.length > best.len)) best = { len: c.href.length, section: s, leaf: c };
    }
  }
  return best ? { section: best.section, leaf: best.leaf } : null;
}
