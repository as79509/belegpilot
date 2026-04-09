"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export interface KeyboardShortcutOptions {
  onOpenCommandPalette?: () => void;
  onShowHelp?: () => void;
}

const NAV_TARGETS: Record<string, string> = {
  d: "/dashboard",
  b: "/documents",
  l: "/suppliers",
  p: "/periods",
  a: "/tasks",
  r: "/rules",
  k: "/corrections",
  e: "/exports",
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Globale Tastenkombinationen:
 * - Cmd+K / Ctrl+K → Command Palette
 * - "?" → Hilfe-Dialog
 * - "G" gefolgt von [d|b|l|p|a|r|k|e] → Navigation (1-Sekunden-Fenster)
 */
export function useKeyboardShortcuts(options: KeyboardShortcutOptions = {}) {
  const router = useRouter();

  useEffect(() => {
    let waitingForSecond = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function clearWaiting() {
      waitingForSecond = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        clearWaiting();
        options.onOpenCommandPalette?.();
        return;
      }

      // Ignore further shortcuts when typing
      if (isEditableTarget(e.target)) return;

      // No modifiers for the rest
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // "?" → Help
      if (e.key === "?") {
        e.preventDefault();
        clearWaiting();
        options.onShowHelp?.();
        return;
      }

      // Sequence "G" then X
      if (waitingForSecond) {
        const key = e.key.toLowerCase();
        const target = NAV_TARGETS[key];
        if (target) {
          e.preventDefault();
          router.push(target);
        }
        clearWaiting();
        return;
      }

      if (e.key.toLowerCase() === "g") {
        waitingForSecond = true;
        timer = setTimeout(() => {
          waitingForSecond = false;
          timer = null;
        }, 1000);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearWaiting();
    };
  }, [router, options]);
}

export interface PageShortcut {
  key: string;
  handler: () => void;
  description?: string;
}

/**
 * Seiten-spezifische Shortcuts. Aktiviert nur wenn der Nutzer NICHT in einem
 * Eingabefeld ist und keine Modifier-Tasten gedrückt sind.
 */
export function usePageShortcuts(shortcuts: PageShortcut[]) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const match = shortcuts.find((s) => s.key.toLowerCase() === e.key.toLowerCase());
      if (match) {
        e.preventDefault();
        match.handler();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}

export const NAVIGATION_SHORTCUTS: { keys: string; label: string; href: string }[] = [
  { keys: "G D", label: "Übersicht", href: "/dashboard" },
  { keys: "G B", label: "Belege", href: "/documents" },
  { keys: "G L", label: "Lieferanten", href: "/suppliers" },
  { keys: "G P", label: "Perioden", href: "/periods" },
  { keys: "G A", label: "Aufgaben", href: "/tasks" },
  { keys: "G R", label: "Regeln", href: "/rules" },
  { keys: "G K", label: "Korrekturen", href: "/corrections" },
  { keys: "G E", label: "Exporte", href: "/exports" },
];
