import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "BelegPilot",
  description: "Buchhaltungsautomatisierung für KMU",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className="h-full antialiased"
      style={{
        ["--font-sans" as string]: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
        ["--font-geist-mono" as string]: '"Consolas", "SFMono-Regular", "Courier New", monospace',
      }}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
