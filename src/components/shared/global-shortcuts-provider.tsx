"use client";

import { useState } from "react";
import { CommandPalette } from "./command-palette";
import { ShortcutHelpDialog } from "./shortcut-help-dialog";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";

export function GlobalShortcutsProvider() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useKeyboardShortcuts({
    onOpenCommandPalette: () => setPaletteOpen(true),
    onShowHelp: () => setHelpOpen(true),
  });

  return (
    <>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
