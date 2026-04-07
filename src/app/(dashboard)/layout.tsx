import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SessionProvider } from "next-auth/react";

export default async function DashboardLayout({
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
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 md:pl-60 overflow-hidden">
          <Header
            userName={session.user.name || "Benutzer"}
            userRole={session.user.role || "readonly"}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/50">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
