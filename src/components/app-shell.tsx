"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Download, Files, Settings2, Users } from "lucide-react";

import { de } from "@/lib/i18n/de";
import { cn } from "@/lib/utils";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const navigation = [
  { href: "/mandanten", label: de.nav.mandanten, icon: Users },
  { href: "/belege", label: de.nav.belege, icon: Files },
  { href: "/export", label: de.nav.export, icon: Download },
  { href: "/einstellungen", label: de.nav.einstellungen, icon: Settings2 },
];

export function AppShell(props: { children: ReactNode }) {
  const pathname = usePathname();
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(true);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const showInstallHint = useMemo(() => !isStandalone && (installEvent || isIos), [installEvent, isIos, isStandalone]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_40%),linear-gradient(180deg,_#f8fbff_0%,_#f5f7fb_45%,_#eef2f7_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-screen-md flex-col px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
        <header className="sticky top-0 z-20 -mx-4 mb-5 border-b border-white/70 bg-white/85 px-4 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                {de.app.name}
              </p>
              <h1 className="text-lg font-semibold text-slate-950">{de.app.subtitle}</h1>
            </div>
            {showInstallHint ? (
              <button
                type="button"
                onClick={async () => {
                  if (installEvent) {
                    await installEvent.prompt();
                    setInstallEvent(null);
                  }
                }}
                className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
              >
                {de.install.action}
              </button>
            ) : null}
          </div>
          {showInstallHint ? (
            <p className="mt-2 text-xs text-slate-500">{isIos ? de.install.ios : de.install.text}</p>
          ) : null}
        </header>

        <main className="flex-1 space-y-6">{props.children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/92 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-screen-md grid-cols-4 gap-2 px-4">
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition",
                  active ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
