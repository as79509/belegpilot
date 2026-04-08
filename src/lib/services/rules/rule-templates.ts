export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  ruleType: string;
  conditions: any[];
  actions: any[];
  isGlobal: boolean;
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: "telekom_6200",
    name: "Telekommunikation → Konto 6200",
    description: "Swisscom, Sunrise, Salt automatisch auf Konto 6200 buchen",
    category: "supplier",
    ruleType: "category_mapping",
    conditions: [{ field: "expenseCategory", operator: "equals", value: "Telekommunikation" }],
    actions: [{ type: "set_account_code", value: "6200" }],
    isGlobal: true,
  },
  {
    id: "office_6500",
    name: "Büromaterial → Konto 6500",
    description: "Migros, Coop Office, Lyreco auf Konto 6500",
    category: "supplier",
    ruleType: "category_mapping",
    conditions: [{ field: "expenseCategory", operator: "equals", value: "Büromaterial" }],
    actions: [{ type: "set_account_code", value: "6500" }],
    isGlobal: true,
  },
  {
    id: "small_auto_approve",
    name: "Kleinbeträge < CHF 100 automatisch genehmigen",
    description: "Verifizierte Lieferanten unter CHF 100 direkt freigeben",
    category: "amount",
    ruleType: "auto_approve",
    conditions: [{ field: "grossAmount", operator: "less_than", value: "100" }],
    actions: [{ type: "auto_approve" }],
    isGlobal: false,
  },
  {
    id: "rent_6000",
    name: "Miete → Konto 6000",
    description: "Mietkosten automatisch auf Konto 6000",
    category: "supplier",
    ruleType: "category_mapping",
    conditions: [{ field: "expenseCategory", operator: "contains", value: "Miete" }],
    actions: [{ type: "set_account_code", value: "6000" }],
    isGlobal: true,
  },
  {
    id: "insurance_6300",
    name: "Versicherungen → Konto 6300",
    description: "Versicherungsprämien auf Konto 6300",
    category: "supplier",
    ruleType: "category_mapping",
    conditions: [{ field: "expenseCategory", operator: "contains", value: "Versicherung" }],
    actions: [{ type: "set_account_code", value: "6300" }],
    isGlobal: true,
  },
  {
    id: "high_amount_review",
    name: "Hohe Beträge > CHF 10.000 immer prüfen",
    description: "Belege über CHF 10.000 nie automatisch freigeben",
    category: "amount",
    ruleType: "supplier_default",
    conditions: [{ field: "grossAmount", operator: "greater_than", value: "10000" }],
    actions: [],
    isGlobal: true,
  },
];
