"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { de } from "@/lib/i18n/de";
import { NAVIGATION_SHORTCUTS } from "@/lib/hooks/use-keyboard-shortcuts";

interface ShortcutHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutRow {
  keys: string;
  label: string;
}

const GLOBAL_SHORTCUTS: ShortcutRow[] = [
  { keys: "Cmd+K / Ctrl+K", label: de.shortcuts.commandPalette },
  { keys: "?", label: de.shortcuts.showHelp },
];

const PAGE_SHORTCUTS: ShortcutRow[] = [
  { keys: "N", label: de.shortcuts.newUpload },
  { keys: "F", label: de.shortcuts.focusSearch },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground">
      {children}
    </kbd>
  );
}

function ShortcutSection({ title, rows }: { title: string; rows: ShortcutRow[] }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="rounded-md border bg-card">
        {rows.map((row, i) => (
          <div
            key={`${title}-${i}`}
            className={`flex items-center justify-between px-3 py-1.5 text-xs ${
              i < rows.length - 1 ? "border-b" : ""
            }`}
          >
            <span>{row.label}</span>
            <span className="flex items-center gap-1">
              {row.keys.split(/\s+/).map((k, idx) => (
                <Kbd key={idx}>{k}</Kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ShortcutHelpDialog({ open, onOpenChange }: ShortcutHelpDialogProps) {
  const navRows: ShortcutRow[] = NAVIGATION_SHORTCUTS.map((s) => ({
    keys: s.keys,
    label: `${de.shortcuts.goTo} ${s.label}`,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{de.shortcuts.title}</DialogTitle>
          <DialogDescription>
            {de.commandPalette.placeholder}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <ShortcutSection title={de.shortcuts.global} rows={GLOBAL_SHORTCUTS} />
          <ShortcutSection title={de.shortcuts.navigation} rows={navRows} />
          <ShortcutSection title={de.shortcuts.pageSpecific} rows={PAGE_SHORTCUTS} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
