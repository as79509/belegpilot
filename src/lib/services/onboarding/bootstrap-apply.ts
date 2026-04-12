import { prisma } from "@/lib/db";

export interface ApplyResult {
  rulesCreated: number;
  knowledgeCreated: number;
  expectedDocsCreated: number;
  supplierDefaultsApplied: number;
  errors: string[];
}

export async function applyBootstrappedItems(
  companyId: string,
  sessionId: string,
  itemIds: string[]
): Promise<ApplyResult> {
  const profile = await prisma.businessProfile.findUnique({ where: { companyId } });
  if (!profile) return { rulesCreated: 0, knowledgeCreated: 0, expectedDocsCreated: 0, supplierDefaultsApplied: 0, errors: ["Kein BusinessProfile gefunden"] };

  const allSuggested = [
    ...((profile.suggestedRules as any[]) || []).map((r: any) => ({ ...r, _type: "rule" })),
    ...((profile.suggestedKnowledge as any[]) || []).map((k: any) => ({ ...k, _type: "knowledge" })),
    ...((profile.suggestedExpectedDocs as any[]) || []).map((e: any) => ({ ...e, _type: "expected_doc" })),
    ...((profile.suggestedSupplierDefaults as any[]) || []).map((s: any) => ({ ...s, _type: "supplier_default" })),
  ];

  let rulesCreated = 0;
  let knowledgeCreated = 0;
  let expectedDocsCreated = 0;
  let supplierDefaultsApplied = 0;
  const errors: string[] = [];
  const confirmed: string[] = [...((profile.confirmedItems as string[]) || [])];

  for (const itemId of itemIds) {
    const item = allSuggested.find((s) => s.id === itemId);
    if (!item) { errors.push(`Item ${itemId} nicht gefunden`); continue; }
    if (confirmed.includes(itemId)) continue;

    try {
      if (item._type === "rule") {
        await prisma.rule.create({
          data: {
            companyId,
            name: item.title || item.description || "Bootstrapped Rule",
            ruleType: item.ruleType === "supplier_to_account" ? "supplier_default" : item.ruleType === "category_mapping" ? "category_mapping" : "vat_logic",
            conditions: {
              supplierName: item.supplierName || undefined,
              category: item.category || undefined,
            },
            actions: {
              accountCode: item.accountCode || undefined,
              category: item.category || undefined,
            },
            isActive: true,
          },
        });
        rulesCreated++;
      } else if (item._type === "knowledge") {
        await prisma.knowledgeItem.create({
          data: {
            companyId,
            title: item.title || "Onboarding-Insight",
            content: item.content || item.description || "",
            category: item.insightType || "general",
            isActive: true,
          },
        });
        knowledgeCreated++;
      } else if (item._type === "expected_doc") {
        await prisma.expectedDocument.create({
          data: {
            companyId,
            name: item.name || item.title || item.counterparty || "Erwarteter Beleg",
            counterparty: item.counterparty || "",
            frequency: item.frequency || "monthly",
            isActive: true,
          },
        });
        expectedDocsCreated++;
      } else if (item._type === "supplier_default") {
        if (item.supplierId) {
          await prisma.supplier.update({
            where: { id: item.supplierId },
            data: {
              defaultAccountCode: item.accountCode || undefined,
              defaultCategory: item.category || undefined,
            },
          });
          supplierDefaultsApplied++;
        } else if (item.supplierName) {
          const supplier = await prisma.supplier.findFirst({
            where: { companyId, nameNormalized: item.supplierName },
          });
          if (supplier) {
            await prisma.supplier.update({
              where: { id: supplier.id },
              data: {
                defaultAccountCode: item.accountCode || undefined,
                defaultCategory: item.category || undefined,
              },
            });
            supplierDefaultsApplied++;
          } else {
            errors.push(`Lieferant "${item.supplierName}" nicht gefunden`);
          }
        }
      }

      confirmed.push(itemId);
    } catch (err: any) {
      errors.push(`${item._type} ${itemId}: ${err.message}`);
    }
  }

  // Update confirmed items in profile
  await prisma.businessProfile.update({
    where: { id: profile.id },
    data: { confirmedItems: confirmed },
  });

  return { rulesCreated, knowledgeCreated, expectedDocsCreated, supplierDefaultsApplied, errors };
}
