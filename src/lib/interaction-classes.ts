// Konsistente Interaktionsklassen für das gesamte Produkt
export const interact = {
  // Klickbare Cards
  card: "transition-all duration-150 hover:shadow-md hover:border-primary/20 cursor-pointer",
  cardSubtle: "transition-shadow duration-150 hover:shadow-sm",

  // Buttons (zusätzlich zu shadcn defaults)
  buttonPress: "active:scale-[0.98] transition-transform duration-75",

  // Tabellen-Zeilen
  tableRow: "transition-colors hover:bg-muted/50 cursor-pointer",
  tableRowSelected: "bg-primary/5 hover:bg-primary/10",

  // Links
  link: "transition-colors hover:text-primary",
  linkSubtle: "transition-colors hover:text-foreground",

  // Badges (klickbar)
  badgeClick: "cursor-pointer transition-opacity hover:opacity-80",

  // Fokus-Ring (für Accessibility)
  focusRing: "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none",

  // Panels
  panelExpand: "transition-all duration-200 ease-in-out",
} as const;
