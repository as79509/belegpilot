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

/**
 * Phase 8.9.2 — Konflikterkennung
 *
 * Findet Regeln, die sich gegenseitig stören oder zu unvorhersehbaren
 * Ergebnissen führen können.
 */

export type RuleConflictType =
  | "same_conditions_different_actions"
  | "priority_overlap"
  | "inactive_overrides_active"
  | "duplicate_rule";

export interface RuleConflict {
  rule1Id: string;
  rule1Name: string;
  rule2Id: string;
  rule2Name: string;
  type: RuleConflictType;
  description: string;
}

export interface RuleWarning {
  ruleId: string;
  ruleName: string;
  message: string;
}

export interface ConflictReport {
  conflicts: RuleConflict[];
  warnings: RuleWarning[];
  checkedAt: string;
  totalRules: number;
}

interface RuleLike {
  id: string;
  name: string;
  ruleType?: string;
  priority: number;
  isActive: boolean;
  conditions: unknown;
  actions: unknown;
}

/**
 * Normalisiert ein Bedingungs-Set zu einem Vergleichsstring.
 * Reihenfolge spielt keine Rolle (sortiert).
 */
function conditionsKey(conditions: unknown): string {
  if (!Array.isArray(conditions)) return "";
  const items = conditions
    .filter((c): c is RuleCondition => !!c && typeof c === "object")
    .map((c) => {
      const field = String((c as any).field || "");
      const operator = String((c as any).operator || "");
      const value = String((c as any).value || "").toLowerCase();
      return `${field}|${operator}|${value}`;
    });
  return items.sort().join("&&");
}

function actionsKey(actions: unknown): string {
  if (!Array.isArray(actions)) return "";
  const items = actions
    .filter((a): a is RuleAction => !!a && typeof a === "object")
    .map((a) => {
      const type = String((a as any).type || "");
      const value = String((a as any).value ?? "").toLowerCase();
      return `${type}|${value}`;
    });
  return items.sort().join("&&");
}

/**
 * Erkennt Regelkonflikte:
 * 1. Zwei Regeln mit gleichen Bedingungen aber unterschiedlichen Aktionen
 * 2. Doppelte Regeln (gleiche Bedingungen UND gleiche Aktionen)
 * 3. Inaktive Regeln, die aktive überschreiben würden (gleiche Bedingungen, höhere Priorität)
 * 4. Gleiche Priorität bei überlappenden Bedingungen → unvorhersehbare Reihenfolge
 */
export function detectRuleConflicts(rules: RuleLike[]): ConflictReport {
  const conflicts: RuleConflict[] = [];
  const warnings: RuleWarning[] = [];

  // Index nach conditionsKey
  const byConditions = new Map<string, RuleLike[]>();
  for (const rule of rules) {
    const key = conditionsKey(rule.conditions);
    if (!key) continue;
    const list = byConditions.get(key) ?? [];
    list.push(rule);
    byConditions.set(key, list);
  }

  // Doppelt-Erkennung & gleiche Bedingungen / unterschiedliche Aktionen
  for (const [, group] of byConditions) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const sameActions = actionsKey(a.actions) === actionsKey(b.actions);

        if (sameActions) {
          conflicts.push({
            rule1Id: a.id,
            rule1Name: a.name,
            rule2Id: b.id,
            rule2Name: b.name,
            type: "duplicate_rule",
            description: `Beide Regeln haben identische Bedingungen und Aktionen.`,
          });
        } else {
          conflicts.push({
            rule1Id: a.id,
            rule1Name: a.name,
            rule2Id: b.id,
            rule2Name: b.name,
            type: "same_conditions_different_actions",
            description:
              `Identische Bedingungen, aber unterschiedliche Aktionen. ` +
              `Es gewinnt die Regel mit der höheren Priorität ` +
              `(${a.name}: ${a.priority} vs. ${b.name}: ${b.priority}).`,
          });
        }

        // Inaktive überschreibt aktive (gleiche Bedingungen, höhere Priorität)
        if (!a.isActive && b.isActive && a.priority > b.priority) {
          conflicts.push({
            rule1Id: a.id,
            rule1Name: a.name,
            rule2Id: b.id,
            rule2Name: b.name,
            type: "inactive_overrides_active",
            description:
              `${a.name} ist inaktiv, hätte aber höhere Priorität als die aktive Regel ${b.name}. ` +
              `Beim Aktivieren würde sie ${b.name} überschreiben.`,
          });
        }
        if (!b.isActive && a.isActive && b.priority > a.priority) {
          conflicts.push({
            rule1Id: b.id,
            rule1Name: b.name,
            rule2Id: a.id,
            rule2Name: a.name,
            type: "inactive_overrides_active",
            description:
              `${b.name} ist inaktiv, hätte aber höhere Priorität als die aktive Regel ${a.name}. ` +
              `Beim Aktivieren würde sie ${a.name} überschreiben.`,
          });
        }

        // Gleiche Priorität → unvorhersehbar
        if (a.isActive && b.isActive && a.priority === b.priority && !sameActions) {
          conflicts.push({
            rule1Id: a.id,
            rule1Name: a.name,
            rule2Id: b.id,
            rule2Name: b.name,
            type: "priority_overlap",
            description:
              `Beide Regeln sind aktiv und haben dieselbe Priorität (${a.priority}) bei gleichen Bedingungen. ` +
              `Die Reihenfolge der Anwendung ist nicht vorhersehbar.`,
          });
        }
      }
    }
  }

  // Warnungen: Regeln mit ungewöhnlich hoher Priorität (>100) oder ohne Bedingungen
  for (const rule of rules) {
    if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
      warnings.push({
        ruleId: rule.id,
        ruleName: rule.name,
        message: `Regel hat keine Bedingungen — sie würde auf alle Belege angewendet.`,
      });
    }
    if (rule.priority > 100) {
      warnings.push({
        ruleId: rule.id,
        ruleName: rule.name,
        message: `Sehr hohe Priorität (${rule.priority}) — kann andere Regeln verdrängen.`,
      });
    }
    if (!Array.isArray(rule.actions) || rule.actions.length === 0) {
      warnings.push({
        ruleId: rule.id,
        ruleName: rule.name,
        message: `Regel hat keine Aktionen — sie hat keinen Effekt.`,
      });
    }
  }

  return {
    conflicts,
    warnings,
    checkedAt: new Date().toISOString(),
    totalRules: rules.length,
  };
}
