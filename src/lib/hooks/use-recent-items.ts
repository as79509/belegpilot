"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "belegpilot:recent-items";
const MAX_ITEMS = 10;

export type RecentItemType = "document" | "supplier" | "task" | "rule" | "period" | "knowledge";

export interface RecentItem {
  type: RecentItemType;
  id: string;
  title: string;
  url: string;
  timestamp: number;
}

function readStorage(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i): i is RecentItem =>
        i &&
        typeof i.type === "string" &&
        typeof i.id === "string" &&
        typeof i.title === "string" &&
        typeof i.url === "string" &&
        typeof i.timestamp === "number"
    );
  } catch {
    return [];
  }
}

function writeStorage(items: RecentItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("belegpilot:recent-items-changed"));
  } catch {
    // ignore quota errors
  }
}

export function useRecentItems() {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    setItems(readStorage());
    function onChange() {
      setItems(readStorage());
    }
    window.addEventListener("belegpilot:recent-items-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("belegpilot:recent-items-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const addRecent = useCallback(
    (type: RecentItemType, id: string, title: string, url: string) => {
      const current = readStorage();
      const filtered = current.filter((i) => !(i.type === type && i.id === id));
      const next: RecentItem[] = [
        { type, id, title, url, timestamp: Date.now() },
        ...filtered,
      ].slice(0, MAX_ITEMS);
      writeStorage(next);
      setItems(next);
    },
    []
  );

  const getRecent = useCallback((): RecentItem[] => {
    return [...items].sort((a, b) => b.timestamp - a.timestamp);
  }, [items]);

  const clearRecent = useCallback(() => {
    writeStorage([]);
    setItems([]);
  }, []);

  return { items: getRecent(), addRecent, getRecent, clearRecent };
}
