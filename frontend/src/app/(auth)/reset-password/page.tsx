import type { Metadata } from "next";
import { ResetFlow } from "@/components/auth/reset-flow";
import { LedgerPanel, standingLine } from "@/components/auth/ledger-panel";
import { companyMonogram } from "@/components/auth/seal";
import { getBrandingSSR } from "@/lib/server/branding";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandingSSR();
  return { title: brand?.tradeName ? `Reset password · ${brand.tradeName}` : "Reset password" };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const brand = await getBrandingSSR();
  const sp = await searchParams;
  const token = typeof sp.token === "string" && sp.token.length > 0 ? sp.token : undefined;

  return (
    <main className="min-h-screen bg-paper text-ink font-sans lg:grid lg:grid-cols-[1.4fr_1fr]">
      <LedgerPanel name={brand?.tradeName ?? "Backoffice"} standing={standingLine(brand)} />
      <section className="flex flex-1 items-center justify-center bg-paper-raised">
        <ResetFlow token={token} monogram={companyMonogram(brand?.tradeName)} />
      </section>
    </main>
  );
}
