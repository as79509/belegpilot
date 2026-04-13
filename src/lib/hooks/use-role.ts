"use client";
import { useCompany } from "@/lib/contexts/company-context";

export type AppRole = "viewer" | "reviewer" | "trustee" | "admin";

export function normalizeAppRole(rawRole: string | null | undefined): AppRole {
  switch (rawRole) {
    case "admin":
      return "admin";
    case "trustee":
      return "trustee";
    case "reviewer":
      return "reviewer";
    default:
      return "viewer";
  }
}

export function useRole(): {
  role: AppRole;
  isReviewer: boolean;
  isTrustee: boolean;
  isViewer: boolean;
  isAdmin: boolean;
  isBackoffice: boolean;
} {
  const { activeCompany } = useCompany();
  const role = normalizeAppRole(activeCompany?.role);
  return {
    role,
    isReviewer: role === "reviewer",
    isTrustee: role === "trustee" || role === "admin",
    isViewer: role === "viewer",
    isAdmin: role === "admin",
    isBackoffice: role !== "viewer",
  };
}
