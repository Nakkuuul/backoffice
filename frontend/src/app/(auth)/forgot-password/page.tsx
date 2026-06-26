import type { Metadata } from "next";
import { ForgotFlow } from "@/components/auth/forgot-flow";
import { LedgerPanel, standingLine } from "@/components/auth/ledger-panel";
import { companyMonogram } from "@/components/auth/seal";
import { getBrandingSSR } from "@/lib/server/branding";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandingSSR();
  return { title: brand?.tradeName ? `Reset password · ${brand.tradeName}` : "Reset password" };
}

export default async function ForgotPasswordPage() {
  const brand = await getBrandingSSR();
  return (
    <main className="min-h-screen bg-paper text-ink font-sans lg:grid lg:grid-cols-[1.4fr_1fr]">
      <LedgerPanel name={brand?.tradeName ?? "Backoffice"} standing={standingLine(brand)} />
      <section className="flex flex-1 items-center justify-center bg-paper-raised">
        <ForgotFlow monogram={companyMonogram(brand?.tradeName)} />
      </section>
    </main>
  );
}
