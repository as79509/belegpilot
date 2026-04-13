import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SessionProvider } from "next-auth/react";
import { CompanyProvider } from "@/lib/contexts/company-context";

export const metadata: Metadata = {
  title: "Mandant einrichten | BelegPilot",
  description: "Richten Sie einen neuen Mandanten ein",
};

export default async function OnboardingWizardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <SessionProvider session={session}>
      <CompanyProvider>
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </CompanyProvider>
    </SessionProvider>
  );
}
