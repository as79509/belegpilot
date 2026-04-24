import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "BelegPilot Lite",
  description: "Mobile first Treuhand-App fuer Belege, Kontierung und Banana Export.",
  applicationName: "BelegPilot Lite",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BelegPilot Lite",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout(props: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <AppShell>{props.children}</AppShell>
      </body>
    </html>
  );
}
