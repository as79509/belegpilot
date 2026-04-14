import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { de } from "@/lib/i18n/de";

const mockUseCompany = vi.fn();
const mockUseRecentItems = vi.fn();
const mockUseParams = vi.fn(() => ({ id: "supplier-1" }));
const mockUseRouter = vi.fn(() => ({ push: vi.fn() }));
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
  useRouter: () => mockUseRouter(),
}));

vi.mock("@/lib/contexts/company-context", () => ({
  useCompany: () => mockUseCompany(),
}));

vi.mock("@/lib/hooks/use-recent-items", () => ({
  useRecentItems: () => mockUseRecentItems(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => toastSuccess(...args),
    error: (...args: any[]) => toastError(...args),
  },
}));

function createCompanyContext(overrides?: Partial<any>) {
  return {
    companies: [
      {
        companyId: "company-1",
        role: "viewer",
        isDefault: true,
        company: { id: "company-1", name: "Mandant Eins", legalName: "Mandant Eins GmbH", currency: "CHF" },
      },
    ],
    activeCompanyId: "company-1",
    activeCompany: {
      companyId: "company-1",
      role: "viewer",
      isDefault: true,
      company: { id: "company-1", name: "Mandant Eins", legalName: "Mandant Eins GmbH", currency: "CHF" },
    },
    switchCompany: vi.fn(),
    loading: false,
    isMultiCompany: false,
    capabilities: {
      role: "viewer",
      permissions: [],
      canMutate: {
        documents: false,
        suppliers: false,
        suppliersVerify: false,
        bank: false,
      },
    },
    capabilitiesLoading: false,
    ...overrides,
  };
}

describe("Phase 4 Hardening Runtime", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockUseRecentItems.mockReturnValue({ addRecent: vi.fn(), items: [] });
    mockUseCompany.mockReturnValue(createCompanyContext());
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
  });

  it("versteckt im Viewer-Dashboard den Upload-CTA, wenn keine Schreibrechte vorhanden sind", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/dashboard/cockpit")) {
        return {
          ok: true,
          json: async () => ({
            alerts: [],
            todayStats: { uploaded: 2, reviewed: 1, tasksDue: 0, autoQuote: 0 },
            statusCounts: {},
            highRiskDocs: [],
            openTasks: [],
            periods: { current: null, last: null },
          }),
        } as any;
      }
      if (url.includes("/api/telemetry")) return { ok: false, json: async () => ({}) } as any;
      if (url.includes("/api/setup/status")) {
        return {
          ok: true,
          json: async () => ({ items: [], completionRate: 100, criticalMissing: [] }),
        } as any;
      }
      if (url.includes("/api/onboarding/golive")) return { ok: true, json: async () => null } as any;
      return { ok: true, json: async () => ({}) } as any;
    });
    global.fetch = fetchMock as any;

    const { default: DashboardPage } = await import("@/app/(dashboard)/dashboard/page");
    const { container } = render(<DashboardPage />);

    await screen.findByText(de.dashboard.uploadReadOnlyTitle);
    expect(screen.getByText(de.dashboard.uploadReadOnlySubtitle)).toBeTruthy();
    expect(container.querySelector('a[href="/documents"]')).toBeNull();
  });

  it("zeigt im Lieferanten-Detail nur Lesezugriff, wenn Supplier-Mutationen nicht erlaubt sind", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/suggest-defaults")) {
        return { ok: true, json: async () => ({ eligible: false, pattern: null }) } as any;
      }
      if (url.includes("/intelligence")) {
        return { ok: true, json: async () => ({ corrections: [], escalations: [], topAccounts: [] }) } as any;
      }
      if (url.includes("/api/suppliers/supplier-1")) {
        return {
          ok: true,
          json: async () => ({
            id: "supplier-1",
            nameNormalized: "Muster AG",
            isVerified: false,
            documentCount: 0,
            documents: [],
            createdAt: "2025-01-01T00:00:00.000Z",
          }),
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });
    global.fetch = fetchMock as any;

    const { default: SupplierDetailPage } = await import("@/app/(dashboard)/suppliers/[id]/page");
    render(<SupplierDetailPage />);

    await screen.findByText("Muster AG");
    expect(screen.getByText(de.suppliers.readOnlyDescription)).toBeTruthy();
    expect(screen.queryByRole("button", { name: de.suppliers.save })).toBeNull();
    expect(screen.queryByRole("button", { name: de.suppliers.verify })).toBeNull();
  });

  it("meldet beim Integrationsimport Top-Level-Route-Fehler ehrlich statt Erfolg", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/integrations")) {
        return {
          ok: true,
          json: async () => ({
            providers: [
              {
                id: "csv",
                name: "CSV",
                description: "CSV Import",
                supportedActions: ["import_accounts"],
                icon: "FileSpreadsheet",
                canImport: true,
                canExport: false,
                isConfigured: true,
                isEnabled: true,
              },
            ],
          }),
        } as any;
      }
      if (url.endsWith("/api/integrations/csv/import")) {
        return {
          ok: false,
          json: async () => ({ error: "Integration ist nicht aktiviert" }),
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });
    global.fetch = fetchMock as any;

    const { default: IntegrationsPage } = await import("@/app/(dashboard)/integrations/page");
    render(<IntegrationsPage />);

    await screen.findByRole("button", { name: de.integrations.actions.import_accounts });
    fireEvent.click(screen.getByRole("button", { name: de.integrations.actions.import_accounts }));

    const fileInput = screen.getByLabelText(de.integrations.csvImport.selectFile) as HTMLInputElement;
    const file = new File(["konto;name"], "konten.csv", { type: "text/csv" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    const submitButton = screen.getByRole("button", { name: de.integrations.csvImport.import });
    fireEvent.submit(submitButton.closest("form")!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/integrations/csv/import",
        expect.objectContaining({ method: "POST" })
      );
      expect(toastError).toHaveBeenCalledWith("Integration ist nicht aktiviert");
    });
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
