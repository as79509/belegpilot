import { prisma } from "@/lib/db";

export interface RuleCondition {
  field: "supplierName" | "invoiceNumber" | "grossAmount" | "currency" | "expenseCategory" | "documentType";
  operator: "equals" | "contains" | "greater_than" | "less_than" | "starts_with";
  value: string;
}

export interface RuleAction {
  type: "set_category" | "set_account_code" | "set_cost_center" | "set_vat_code" | "auto_approve";
  value?: string;
}

export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  ruleType: string;
  actionsApplied: RuleAction[];
}

function getFieldValue(doc: Record<string, any>, field: RuleCondition["field"]): string | number | null {
  switch (field) {
    case "supplierName": return doc.supplierNameNormalized || doc.supplierNameRaw || null;
    case "invoiceNumber": return doc.invoiceNumber || null;
    case "grossAmount": return doc.grossAmount != null ? Number(doc.grossAmount) : null;
    case "currency": return doc.currency || null;
    case "expenseCategory": return doc.expenseCategory || null;
    case "documentType": return doc.documentType || null;
    default: return null;
  }
}

function matchCondition(docValue: string | number | null, operator: RuleCondition["operator"], ruleValue: string): boolean {
  if (docValue == null) return false;

  if (operator === "greater_than" || operator === "less_than") {
    const numDoc = typeof docValue === "number" ? docValue : parseFloat(String(docValue));
    const numRule = parseFloat(ruleValue);
    if (isNaN(numDoc) || isNaN(numRule)) return false;
    return operator === "greater_than" ? numDoc > numRule : numDoc < numRule;
  }

  const strDoc = String(docValue).toLowerCase();
  const strRule = ruleValue.toLowerCase();

  switch (operator) {
    case "equals": return strDoc === strRule;
    case "contains": return strDoc.includes(strRule);
    case "starts_with": return strDoc.startsWith(strRule);
    default: return false;
  }
}

export async function applyRules(
  companyId: string,
  documentId: string,
  docData: Record<string, any>,
  userId?: string
): Promise<{ matches: RuleMatch[]; updates: Record<string, any>; shouldAutoApprove: boolean }> {
  // Load local rules + global rules from all companies the user has access to
  let globalCompanyIds: string[] = [];
  if (userId) {
    const userCompanies = await prisma.userCompany.findMany({
      where: { userId },
      select: { companyId: true },
    });
    globalCompanyIds = userCompanies.map((uc) => uc.companyId).filter((id) => id !== companyId);
  }

  const rules = await prisma.rule.findMany({
    where: {
      isActive: true,
      OR: [
        { companyId },
        ...(globalCompanyIds.length > 0
          ? [{ companyId: { in: globalCompanyIds }, isGlobal: true }]
          : []),
      ],
    },
    orderBy: { priority: "desc" },
  });

  const matches: RuleMatch[] = [];
  const updates: Record<string, any> = {};
  let shouldAutoApprove = false;

  for (const rule of rules) {
    const conditions = rule.conditions as unknown as RuleCondition[];
    const actions = rule.actions as unknown as RuleAction[];

    if (!Array.isArray(conditions) || !Array.isArray(actions)) continue;

    // All conditions must match (AND logic)
    const allMatch = conditions.every((cond) => {
      const val = getFieldValue(docData, cond.field);
      return matchCondition(val, cond.operator, cond.value);
    });

    if (!allMatch) continue;

    matches.push({
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.ruleType,
      actionsApplied: actions,
    });

    // Apply actions (higher priority wins — processed first since sorted DESC)
    for (const action of actions) {
      switch (action.type) {
        case "set_category":
          if (!updates.expenseCategory) updates.expenseCategory = action.value;
          break;
        case "set_account_code":
          if (!updates.accountCode) updates.accountCode = action.value;
          break;
        case "set_cost_center":
          if (!updates.costCenter) updates.costCenter = action.value;
          break;
        case "set_vat_code":
          // Store in vatRatesDetected metadata or a custom field
          break;
        case "auto_approve":
          shouldAutoApprove = true;
          break;
      }
    }
  }

  return { matches, updates, shouldAutoApprove };
}
