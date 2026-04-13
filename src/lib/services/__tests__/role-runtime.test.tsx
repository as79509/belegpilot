import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { normalizeAppRole, useRole } from "@/lib/hooks/use-role";
import { getNavRole, Sidebar } from "@/components/layout/sidebar";
import { de } from "@/lib/i18n/de";

const mockUseCompany = vi.fn();
const mockUsePathname = vi.fn(() => "/documents");

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("@/lib/contexts/company-context", () => ({
  useCompany: () => mockUseCompany(),
}));

function RoleProbe() {
  const { role, isViewer, isReviewer, isTrustee, isAdmin, isBackoffice } = useRole();

  return (
    <div>
      <span data-testid="role">{role}</span>
      <span data-testid="isViewer">{String(isViewer)}</span>
      <span data-testid="isReviewer">{String(isReviewer)}</span>
      <span data-testid="isTrustee">{String(isTrustee)}</span>
      <span data-testid="isAdmin">{String(isAdmin)}</span>
      <span data-testid="isBackoffice">{String(isBackoffice)}</span>
    </div>
  );
}

function createCompanyContext(role: string) {
  return {
    companies: [
      {
        companyId: "company-1",
        role,
        isDefault: true,
        company: { id: "company-1", name: "Mandant Eins", legalName: "Mandant Eins GmbH", currency: "CHF" },
      },
    ],
    activeCompanyId: "company-1",
    activeCompany: {
      companyId: "company-1",
      role,
      isDefault: true,
      company: { id: "company-1", name: "Mandant Eins", legalName: "Mandant Eins GmbH", currency: "CHF" },
    },
    switchCompany: vi.fn(),
    loading: false,
    isMultiCompany: false,
    capabilities: null,
    capabilitiesLoading: false,
  };
}

describe("Role Runtime", () => {
  beforeEach(() => {
    cleanup();
    mockUseCompany.mockReset();
    mockUsePathname.mockReset();
    mockUsePathname.mockReturnValue("/documents");
  });

  it("behandelt reviewer als echte App-Rolle statt als viewer", () => {
    mockUseCompany.mockReturnValue(createCompanyContext("reviewer"));

    render(<RoleProbe />);

    expect(screen.getByTestId("role").textContent).toBe("reviewer");
    expect(screen.getByTestId("isViewer").textContent).toBe("false");
    expect(screen.getByTestId("isReviewer").textContent).toBe("true");
    expect(screen.getByTestId("isTrustee").textContent).toBe("false");
    expect(screen.getByTestId("isBackoffice").textContent).toBe("true");
  });

  it("ordnet readonly weiterhin sauber als viewer ein", () => {
    mockUseCompany.mockReturnValue(createCompanyContext("readonly"));

    render(<RoleProbe />);

    expect(screen.getByTestId("role").textContent).toBe("viewer");
    expect(screen.getByTestId("isViewer").textContent).toBe("true");
    expect(screen.getByTestId("isBackoffice").textContent).toBe("false");
  });

  it("normalisiert unbekannte Rollen defensiv auf viewer", () => {
    expect(normalizeAppRole("reviewer")).toBe("reviewer");
    expect(normalizeAppRole("unknown")).toBe("viewer");
    expect(normalizeAppRole(undefined)).toBe("viewer");
  });

  it("ordnet reviewer in die Backoffice-Navigation ein", () => {
    expect(getNavRole("reviewer")).toBe("reviewer");
    expect(getNavRole("readonly")).toBe("viewer");
  });

  it("zeigt reviewer die Arbeitsnavigation statt der Viewer-Kurzliste", () => {
    mockUseCompany.mockReturnValue(createCompanyContext("reviewer"));

    render(<Sidebar />);

    expect(screen.getByRole("link", { name: de.nav.dashboard })).toBeTruthy();
    expect(screen.getByRole("link", { name: de.nav.documents })).toBeTruthy();
    expect(screen.getByRole("link", { name: de.nav.suppliers })).toBeTruthy();
    expect(screen.getByRole("link", { name: de.journal.title })).toBeTruthy();
    expect(screen.queryByRole("link", { name: de.nav.rules })).toBeNull();
  });

  it("zeigt viewer weiterhin nur die reduzierte Navigation", () => {
    mockUseCompany.mockReturnValue(createCompanyContext("viewer"));

    render(<Sidebar />);

    expect(screen.getByRole("link", { name: de.nav.documents })).toBeTruthy();
    expect(screen.getByRole("link", { name: de.tasksMgmt.title })).toBeTruthy();
    expect(screen.queryByRole("link", { name: de.journal.title })).toBeNull();
  });
});
