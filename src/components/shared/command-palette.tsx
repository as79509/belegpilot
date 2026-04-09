"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Command,
} from "@/components/ui/command";
import {
  FileText,
  Building2,
  CalendarCheck,
  ListTodo,
  Workflow,
  Brain,
  Compass,
  Clock,
} from "lucide-react";
import { de } from "@/lib/i18n/de";
import { useRecentItems, type RecentItemType } from "@/lib/hooks/use-recent-items";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchItem {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

interface SearchGroup {
  category: string;
  items: SearchItem[];
}

const NAV_ITEMS: { label: string; url: string }[] = [
  { label: "Übersicht", url: "/dashboard" },
  { label: de.nav.documents, url: "/documents" },
  { label: de.nav.suppliers, url: "/suppliers" },
  { label: "Perioden", url: "/periods" },
  { label: "Aufgaben", url: "/tasks" },
  { label: de.nav.rules, url: "/rules" },
  { label: "Korrekturen", url: "/corrections" },
  { label: de.nav.exports, url: "/exports" },
  { label: "Journal", url: "/journal" },
  { label: "Anlagen", url: "/assets" },
  { label: "Verträge", url: "/contracts" },
  { label: "Berichte", url: "/reports" },
  { label: "Audit-Log", url: "/audit-log" },
  { label: de.nav.settings, url: "/settings" },
];

function categoryIcon(category: string) {
  switch (category) {
    case "documents":
      return FileText;
    case "suppliers":
      return Building2;
    case "periods":
      return CalendarCheck;
    case "tasks":
      return ListTodo;
    case "rules":
      return Workflow;
    case "knowledge":
      return Brain;
    case "navigation":
      return Compass;
    case "recent":
      return Clock;
    default:
      return FileText;
  }
}

function recentTypeIcon(type: RecentItemType) {
  switch (type) {
    case "document":
      return FileText;
    case "supplier":
      return Building2;
    case "period":
      return CalendarCheck;
    case "task":
      return ListTodo;
    case "rule":
      return Workflow;
    case "knowledge":
      return Brain;
    default:
      return FileText;
  }
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { items: recentItems } = useRecentItems();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset query when closing
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Debounced server-side search
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        .then((r) => r.json())
        .then((d) => {
          setResults(Array.isArray(d.results) ? d.results : []);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      clearTimeout(handle);
    };
  }, [query]);

  const navMatches = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (t.length < 2) return [];
    return NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(t)).slice(0, 6);
  }, [query]);

  function handleSelect(url: string) {
    onOpenChange(false);
    router.push(url);
  }

  const showRecent = query.trim().length < 2 && recentItems.length > 0;
  const recentTop = recentItems.slice(0, 5);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={de.commandPalette.placeholder}
      description={de.commandPalette.placeholder}
      className="max-w-xl"
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={de.commandPalette.placeholder}
        />
        <CommandList>
          {!showRecent && !loading && results.length === 0 && navMatches.length === 0 && query.trim().length >= 2 && (
            <CommandEmpty>{de.commandPalette.noResults}</CommandEmpty>
          )}

          {showRecent && (
            <CommandGroup heading={de.commandPalette.categories.recent}>
              {recentTop.map((item) => {
                const Icon = recentTypeIcon(item.type);
                return (
                  <CommandItem
                    key={`recent-${item.type}-${item.id}`}
                    value={`recent-${item.type}-${item.id}`}
                    onSelect={() => handleSelect(item.url)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{item.title}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {showRecent && <CommandSeparator />}

          {showRecent && (
            <CommandGroup heading={de.commandPalette.categories.navigation}>
              {NAV_ITEMS.slice(0, 8).map((n) => {
                const Icon = Compass;
                return (
                  <CommandItem
                    key={`nav-default-${n.url}`}
                    value={`nav-default-${n.url}`}
                    onSelect={() => handleSelect(n.url)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{n.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {results.map((group, gi) => {
            const Icon = categoryIcon(group.category);
            const heading =
              de.commandPalette.categories[
                group.category as keyof typeof de.commandPalette.categories
              ] || group.category;
            return (
              <CommandGroup key={`g-${group.category}-${gi}`} heading={heading}>
                {group.items.map((item) => (
                  <CommandItem
                    key={`${group.category}-${item.id}`}
                    value={`${group.category}-${item.id}-${item.title}`}
                    onSelect={() => handleSelect(item.url)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{item.title}</span>
                      {item.subtitle && (
                        <span className="text-xs text-muted-foreground truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}

          {navMatches.length > 0 && (
            <CommandGroup heading={de.commandPalette.categories.navigation}>
              {navMatches.map((n) => (
                <CommandItem
                  key={`nav-${n.url}`}
                  value={`nav-${n.url}-${n.label}`}
                  onSelect={() => handleSelect(n.url)}
                >
                  <Compass className="h-4 w-4 text-muted-foreground" />
                  <span>{n.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
