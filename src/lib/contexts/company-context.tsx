"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface CompanyInfo {
  companyId: string;
  role: string;
  isDefault: boolean;
  company: { id: string; name: string; legalName: string; currency: string };
}

interface Capabilities {
  role: string;
  canMutate: Record<string, boolean>;
  permissions: string[];
}

interface CompanyContextType {
  companies: CompanyInfo[];
  activeCompanyId: string | null;
  activeCompany: CompanyInfo | null;
  switchCompany: (companyId: string) => void;
  loading: boolean;
  isMultiCompany: boolean;
  capabilities: Capabilities | null;
  capabilitiesLoading: boolean;
}

const CompanyContext = createContext<CompanyContextType>({
  companies: [],
  activeCompanyId: null,
  activeCompany: null,
  switchCompany: () => {},
  loading: true,
  isMultiCompany: false,
  capabilities: null,
  capabilitiesLoading: true,
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/companies")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data.companies || []);
        const cookieMatch = document.cookie.match(/belegpilot-company=([^;]+)/);
        const saved = cookieMatch?.[1] || null;
        const validSaved = saved && data.companies?.some((c: CompanyInfo) => c.companyId === saved);
        setActiveCompanyId(validSaved ? saved : data.activeCompanyId || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch capabilities when activeCompanyId changes
  useEffect(() => {
    if (!activeCompanyId) return;
    setCapabilitiesLoading(true);
    fetch("/api/user/capabilities")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setCapabilities(data); })
      .catch(() => {})
      .finally(() => setCapabilitiesLoading(false));
  }, [activeCompanyId]);

  function switchCompany(companyId: string) {
    setActiveCompanyId(companyId);
    document.cookie = `belegpilot-company=${companyId};path=/;max-age=31536000`;
    window.location.reload();
  }

  const activeCompany = companies.find((c) => c.companyId === activeCompanyId) || null;

  return (
    <CompanyContext.Provider
      value={{
        companies,
        activeCompanyId,
        activeCompany,
        switchCompany,
        loading,
        isMultiCompany: companies.length > 1,
        capabilities,
        capabilitiesLoading,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}

export function useCanMutate(domain: string): boolean {
  const { capabilities } = useCompany();
  return capabilities?.canMutate?.[domain] ?? false;
}
