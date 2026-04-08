"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface CompanyInfo {
  companyId: string;
  role: string;
  isDefault: boolean;
  company: { id: string; name: string; legalName: string; currency: string };
}

interface CompanyContextType {
  companies: CompanyInfo[];
  activeCompanyId: string | null;
  activeCompany: CompanyInfo | null;
  switchCompany: (companyId: string) => void;
  loading: boolean;
  isMultiCompany: boolean;
}

const CompanyContext = createContext<CompanyContextType>({
  companies: [],
  activeCompanyId: null,
  activeCompany: null,
  switchCompany: () => {},
  loading: true,
  isMultiCompany: false,
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/companies")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data.companies || []);
        // Check localStorage for saved preference
        // Read from cookie
        const cookieMatch = document.cookie.match(/belegpilot-company=([^;]+)/);
        const saved = cookieMatch?.[1] || null;
        const validSaved = saved && data.companies?.some((c: CompanyInfo) => c.companyId === saved);
        setActiveCompanyId(validSaved ? saved : data.activeCompanyId || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function switchCompany(companyId: string) {
    setActiveCompanyId(companyId);
    document.cookie = `belegpilot-company=${companyId};path=/;max-age=31536000`;
    // Reload page to refresh all data with new company context
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
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
