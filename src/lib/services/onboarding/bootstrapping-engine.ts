import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";
import { classifyBootstrapDocuments } from "./document-classifier";
import { analyzeNewClient } from "./onboarding-analyzer";

export type GovernanceStatus = "confirmed" | "suggested" | "uncertain" | "manual_confirm" | "internal_only" | "not_ready";

export interface BootstrappedItem {
  id: string;
  type: "rule" | "knowledge" | "expected_doc" | "supplier_default" | "deadline" | "risk";
  title: string;
  description: string;
  governance: GovernanceStatus;
  confidence: "high" | "medium" | "low";
  source: "stammdaten" | "documents" | "chat" | "analyzer" | "combined";
  data: Record<string, any>;
}

export interface BootstrappingResult {
  items: BootstrappedItem[];
  summary: {
    total: number;
    byType: Record<string, number>;
    byGovernance: Record<string, number>;
    readinessImpact: Record<string, string>;
  };
  newKnownUnknowns: Array<{
    area: string;
    description: string;
    criticality: "low" | "medium" | "high";
    suggestedAction: string;
  }>;
}

export async function runBootstrapping(companyId: string, sessionId: string): Promise<BootstrappingResult> {
  // 1. Gather all data sources in parallel
  const [company, profile, suppliers, existingRules, existingKnowledge, existingExpected, classification, analysis] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
    prisma.businessProfile.findUnique({ where: { companyId } }),
    prisma.supplier.findMany({ where: { companyId }, select: { id: true, nameNormalized: true, isVerified: true, defaultAccountCode: true, defaultCategory: true } }),
    prisma.rule.findMany({ where: { companyId }, select: { id: true, ruleType: true, conditions: true } }),
    prisma.knowledgeItem.findMany({ where: { companyId }, select: { id: true, title: true } }),
    prisma.expectedDocument.findMany({ where: { companyId }, select: { id: true, name: true } }),
    classifyBootstrapDocuments(companyId).catch(() => null),
    analyzeNewClient(companyId).catch(() => null),
  ]);

  const chatInsights = (profile?.insights as any[] || []) as Array<{ id?: string; type: string; content: string; confidence: string; confirmed?: boolean }>;
  const chatSuggestedRules = (profile?.suggestedRules as any[] || []) as Array<{ type: string; description: string; confidence: string; supplierName?: string; accountCode?: string }>;
  const chatSuggestedKnowledge = (profile?.suggestedKnowledge as any[] || []) as Array<{ title: string; content: string; confidence: string }>;
  const chatSuggestedExpected = (profile?.suggestedExpectedDocs as any[] || []) as Array<{ name: string; counterparty: string; frequency: string; confidence: string }>;
  const chatSuggestedDefaults = (profile?.suggestedSupplierDefaults as any[] || []) as Array<{ supplierName: string; accountCode: string; category: string; confidence: string }>;
  const analyzerRules = analysis?.suggestedRules || [];

  const items: BootstrappedItem[] = [];
  const existingRuleKeys = new Set<string>();

  // 2. Rules from analyzer (Phase 9.6)
  for (const r of analyzerRules) {
    if (r.confidence === "low") continue;
    const key = `${r.supplierName || ""}:${r.accountCode || ""}:${r.type}`;
    existingRuleKeys.add(key);
    items.push({
      id: randomUUID(), type: "rule",
      title: `${r.type}: ${r.description}`,
      description: r.description,
      governance: "suggested",
      confidence: r.confidence as "high" | "medium",
      source: "analyzer",
      data: { ruleType: r.type, supplierName: r.supplierName, accountCode: r.accountCode, category: r.category, basedOnCount: r.basedOnCount },
    });
  }

  // 3. Rules from chat
  for (const r of chatSuggestedRules) {
    const key = `${r.supplierName || ""}:${r.accountCode || ""}:${r.type}`;
    if (existingRuleKeys.has(key)) {
      // Upgrade existing to combined if chat confirms
      const existing = items.find((i) => i.type === "rule" && i.data.ruleType === r.type && i.data.supplierName === r.supplierName);
      if (existing) { existing.source = "combined"; existing.confidence = "high"; }
      continue;
    }
    existingRuleKeys.add(key);
    items.push({
      id: randomUUID(), type: "rule",
      title: `${r.type}: ${r.description}`,
      description: r.description,
      governance: r.confidence === "high" ? "suggested" : "uncertain",
      confidence: r.confidence as "high" | "medium" | "low",
      source: "chat",
      data: { ruleType: r.type, supplierName: r.supplierName, accountCode: r.accountCode, description: r.description },
    });
  }

  // 4. Rules from document classification (recurring with consistent account)
  if (classification) {
    const supplierAccounts = new Map<string, { account: string; count: number }>();
    const docs = await prisma.document.findMany({
      where: { companyId, status: { notIn: ["rejected", "failed"] } },
      select: { supplierNameNormalized: true, accountCode: true },
    });
    for (const d of docs) {
      if (!d.supplierNameNormalized || !d.accountCode) continue;
      const key = `${d.supplierNameNormalized}:${d.accountCode}`;
      const entry = supplierAccounts.get(d.supplierNameNormalized);
      if (!entry) { supplierAccounts.set(d.supplierNameNormalized, { account: d.accountCode, count: 1 }); }
      else if (entry.account === d.accountCode) { entry.count++; }
    }
    for (const [supplier, { account, count }] of supplierAccounts) {
      if (count < 3) continue;
      const ruleKey = `${supplier}:${account}:supplier_to_account`;
      if (existingRuleKeys.has(ruleKey)) continue;
      existingRuleKeys.add(ruleKey);
      items.push({
        id: randomUUID(), type: "rule",
        title: `Kontierung: ${supplier} \u2192 ${account}`,
        description: `Lieferant "${supplier}" wird ${count}x auf Konto ${account} gebucht`,
        governance: count >= 5 ? "suggested" : "uncertain",
        confidence: count >= 5 ? "high" : "medium",
        source: "documents",
        data: { ruleType: "supplier_to_account", supplierName: supplier, accountCode: account, basedOnCount: count },
      });
    }
  }

  // 5. Knowledge items from chat insights
  const knowledgeTypes = ["special_case", "vat_special", "risk"];
  for (const insight of chatInsights) {
    if (!knowledgeTypes.includes(insight.type)) continue;
    items.push({
      id: randomUUID(), type: "knowledge",
      title: insight.type === "special_case" ? "Besonderheit" : insight.type === "vat_special" ? "MwSt-Sonderfall" : "Risikofaktor",
      description: insight.content,
      governance: insight.confidence === "high" ? "suggested" : "manual_confirm",
      confidence: insight.confidence as "high" | "medium" | "low",
      source: "chat",
      data: { insightType: insight.type, content: insight.content },
    });
  }
  for (const k of chatSuggestedKnowledge) {
    items.push({
      id: randomUUID(), type: "knowledge",
      title: k.title, description: k.content,
      governance: k.confidence === "high" ? "suggested" : "manual_confirm",
      confidence: k.confidence as "high" | "medium" | "low",
      source: "chat",
      data: { title: k.title, content: k.content },
    });
  }

  // 6. Expected documents
  const expectedKeys = new Set<string>();
  if (classification) {
    for (const doc of classification.documents) {
      if (doc.classification !== "recurring" || !doc.supplierName) continue;
      if (expectedKeys.has(doc.supplierName)) continue;
      expectedKeys.add(doc.supplierName);
      items.push({
        id: randomUUID(), type: "expected_doc",
        title: `Erwarteter Beleg: ${doc.supplierName}`,
        description: `Wiederkehrender Beleg von ${doc.supplierName} (${doc.amount ? doc.amount.toFixed(2) + " CHF" : "Betrag variiert"})`,
        governance: "suggested", confidence: "high", source: "documents",
        data: { counterparty: doc.supplierName, estimatedAmount: doc.amount, frequency: "monthly" },
      });
    }
  }
  for (const e of chatSuggestedExpected) {
    if (expectedKeys.has(e.counterparty)) continue;
    expectedKeys.add(e.counterparty);
    items.push({
      id: randomUUID(), type: "expected_doc",
      title: `Erwarteter Beleg: ${e.name}`,
      description: `${e.name} von ${e.counterparty}, ${e.frequency}`,
      governance: e.confidence === "high" ? "suggested" : "uncertain",
      confidence: e.confidence as "high" | "medium" | "low",
      source: "chat",
      data: { name: e.name, counterparty: e.counterparty, frequency: e.frequency },
    });
  }

  // 7. Supplier defaults
  for (const sd of chatSuggestedDefaults) {
    items.push({
      id: randomUUID(), type: "supplier_default",
      title: `Default: ${sd.supplierName}`,
      description: `Konto ${sd.accountCode}, Kategorie ${sd.category}`,
      governance: sd.confidence === "high" ? "suggested" : "uncertain",
      confidence: sd.confidence as "high" | "medium" | "low",
      source: "chat",
      data: { supplierName: sd.supplierName, accountCode: sd.accountCode, category: sd.category },
    });
  }
  // From verified suppliers with consistent accounts
  for (const s of suppliers) {
    if (!s.isVerified || !s.defaultAccountCode) continue;
    const alreadyHasDefault = items.some((i) => i.type === "supplier_default" && i.data.supplierName === s.nameNormalized);
    if (alreadyHasDefault) continue;
    items.push({
      id: randomUUID(), type: "supplier_default",
      title: `Default: ${s.nameNormalized}`,
      description: `Konto ${s.defaultAccountCode}${s.defaultCategory ? `, Kategorie ${s.defaultCategory}` : ""}`,
      governance: "suggested", confidence: "high", source: "documents",
      data: { supplierName: s.nameNormalized, supplierId: s.id, accountCode: s.defaultAccountCode, category: s.defaultCategory },
    });
  }

  // 8. Deadlines from chat
  for (const insight of chatInsights.filter((i) => i.type === "deadline")) {
    items.push({
      id: randomUUID(), type: "deadline",
      title: "Frist", description: insight.content,
      governance: "manual_confirm", confidence: "medium", source: "chat",
      data: { content: insight.content },
    });
  }
  // MwSt deadlines from company data
  if (company.vatLiable && company.vatInterval) {
    items.push({
      id: randomUUID(), type: "deadline",
      title: "MwSt-Abrechnung",
      description: `${company.vatInterval === "quarterly" ? "Vierteljährliche" : company.vatInterval === "semi_annual" ? "Halbjährliche" : "Jährliche"} MwSt-Abrechnung`,
      governance: "confirmed", confidence: "high", source: "stammdaten",
      data: { interval: company.vatInterval, vatMethod: company.vatMethod },
    });
  }

  // 9. Risks
  for (const insight of chatInsights.filter((i) => i.type === "risk")) {
    items.push({
      id: randomUUID(), type: "risk",
      title: "Risikofaktor", description: insight.content,
      governance: "manual_confirm", confidence: insight.confidence as "high" | "medium" | "low",
      source: "chat", data: { content: insight.content },
    });
  }
  if (classification) {
    const exceptionRate = classification.summary.byClass.exception / Math.max(classification.summary.total, 1);
    const uncertainRate = classification.summary.byClass.uncertain / Math.max(classification.summary.total, 1);
    if (exceptionRate + uncertainRate > 0.2) {
      items.push({
        id: randomUUID(), type: "risk",
        title: "Hohe Unsicherheitsquote",
        description: `${Math.round((exceptionRate + uncertainRate) * 100)}% der Belege sind Ausnahmen oder unsicher klassifiziert`,
        governance: "internal_only", confidence: "high", source: "documents",
        data: { exceptionRate, uncertainRate },
      });
    }
  }

  // 10. KnownUnknowns for gaps
  const newKnownUnknowns: BootstrappingResult["newKnownUnknowns"] = [];
  const ruleCount = items.filter((i) => i.type === "rule").length;
  const docTotal = classification?.summary.total ?? 0;
  if (ruleCount === 0 && docTotal > 10) {
    newKnownUnknowns.push({ area: "regeln", description: "Keine automatischen Kontierungsregeln ableitbar", criticality: "medium", suggestedAction: "Mehr Belege mit konsistenter Kontierung hochladen" });
  }
  if (items.filter((i) => i.type === "expected_doc").length === 0 && classification && classification.summary.recurringCandidates > 0) {
    newKnownUnknowns.push({ area: "erwartete_belege", description: "Wiederkehrende Belege erkannt, aber keine erwarteten Dokumente definiert", criticality: "medium", suggestedAction: "Erwartete Dokumente aus erkannten Mustern anlegen" });
  }
  if (items.filter((i) => i.type === "knowledge").length === 0) {
    newKnownUnknowns.push({ area: "wissen", description: "Keine fachlichen Besonderheiten erkannt", criticality: "low", suggestedAction: "Im Gesch\u00e4ftsmodell-Chat Besonderheiten beschreiben" });
  }

  // Summary
  const byType: Record<string, number> = {};
  const byGovernance: Record<string, number> = {};
  for (const item of items) {
    byType[item.type] = (byType[item.type] || 0) + 1;
    byGovernance[item.governance] = (byGovernance[item.governance] || 0) + 1;
  }

  const readinessImpact: Record<string, string> = {};
  if (ruleCount > 0) readinessImpact["autopilot"] = "Regeln erm\u00f6glichen Vorschl\u00e4ge";
  if (items.some((i) => i.type === "expected_doc")) readinessImpact["expected_docs"] = "Fehlende Belege erkennbar";
  if (items.some((i) => i.type === "supplier_default")) readinessImpact["lieferanten"] = "Automatische Kontierung";

  // 11. Save to BusinessProfile
  if (profile) {
    const allSuggestedRules = [...(profile.suggestedRules as any[] || [])];
    const allSuggestedKnowledge = [...(profile.suggestedKnowledge as any[] || [])];
    const allSuggestedExpected = [...(profile.suggestedExpectedDocs as any[] || [])];
    const allSuggestedDefaults = [...(profile.suggestedSupplierDefaults as any[] || [])];

    for (const item of items) {
      const entry = { id: item.id, ...item.data, governance: item.governance, confidence: item.confidence, source: item.source, title: item.title };
      if (item.type === "rule" && !allSuggestedRules.some((r: any) => r.id === item.id)) allSuggestedRules.push(entry);
      if (item.type === "knowledge" && !allSuggestedKnowledge.some((k: any) => k.id === item.id)) allSuggestedKnowledge.push(entry);
      if (item.type === "expected_doc" && !allSuggestedExpected.some((e: any) => e.id === item.id)) allSuggestedExpected.push(entry);
      if (item.type === "supplier_default" && !allSuggestedDefaults.some((s: any) => s.id === item.id)) allSuggestedDefaults.push(entry);
    }

    await prisma.businessProfile.update({
      where: { id: profile.id },
      data: {
        suggestedRules: allSuggestedRules,
        suggestedKnowledge: allSuggestedKnowledge,
        suggestedExpectedDocs: allSuggestedExpected,
        suggestedSupplierDefaults: allSuggestedDefaults,
      },
    });
  }

  return {
    items,
    summary: { total: items.length, byType, byGovernance, readinessImpact },
    newKnownUnknowns,
  };
}
