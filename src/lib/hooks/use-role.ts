"use client";
import { useCompany } from "@/lib/contexts/company-context";

export type AppRole = "viewer" | "trustee" | "admin";

export function useRole(): { role: AppRole; isTrustee: boolean; isViewer: boolean; isAdmin: boolean } {
  const { activeCompany } = useCompany();
  const raw = activeCompany?.role || "viewer";
  const role: AppRole = raw === "admin" ? "admin" : raw === "trustee" ? "trustee" : "viewer";
  return {
    role,
    isTrustee: role === "trustee" || role === "admin",
    isViewer: role === "viewer",
    isAdmin: role === "admin",
  };
}
