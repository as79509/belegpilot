export interface IntegrationProvider {
  id: string;
  name: string;
  description: string;
  supportedActions: IntegrationAction[];
  icon: string;
  canExport: boolean;
  canImport: boolean;
  canSync: boolean;
  requiresApiKey: boolean;
  configFields: ConfigField[];
}

export type IntegrationAction =
  | "export_journal"
  | "export_accounts"
  | "export_suppliers"
  | "import_accounts"
  | "import_journal"
  | "import_bank"
  | "sync_accounts";

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "select";
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface ExportResult {
  success: boolean;
  format: "csv" | "json" | "xml" | "xlsx";
  data: Buffer | string;
  filename: string;
  recordCount: number;
  warnings: string[];
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  warnings: string[];
}

export interface IntegrationAdapter {
  provider: IntegrationProvider;
  executeImport?(companyId: string, action: IntegrationAction, data: Buffer | string, filename: string): Promise<ImportResult>;
  executeExport?(companyId: string, action: IntegrationAction): Promise<ExportResult>;
}
