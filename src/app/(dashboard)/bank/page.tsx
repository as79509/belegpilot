"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityHeader, StatusBadge, EmptyState, ConfidenceBadge, InfoPanel, SectionCard } from "@/components/ds";
import { FirstUseHint } from "@/components/ds/first-use-hint";
import { de } from "@/lib/i18n/de";
import { formatCurrency, formatDate } from "@/lib/i18n/format";
import { Upload, Plus, Landmark, Search, FileText, ArrowRight, CheckCircle2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/lib/contexts/company-context";

// ── Types ──

interface BankTransaction {
  id: string;
  bookingDate: string;
  amount: string | number;
  currency: string;
  isCredit: boolean;
  counterpartyName: string | null;
  paymentReference: string | null;
  remittanceInfo: string | null;
  matchStatus: string;
  matchConfidence: number | null;
  matchMethod: string | null;
  matchedAt: string | null;
  matchedDocumentId: string | null;
  bankAccount: { name: string; iban: string };
  matchedDoc: {
    id: string;
    documentNumber: string | null;
    supplierNameNormalized: string | null;
    grossAmount: string | number | null;
    currency: string | null;
  } | null;
}

interface BankStatement {
  id: string;
  fileName: string | null;
  fromDate: string;
  toDate: string;
  openingBalance: string | number;
  closingBalance: string | number;
  transactionCount: number;
  matchedCount: number;
  importedAt: string;
  bankAccount: { name: string; iban: string };
}

interface BankAccount {
  id: string;
  iban: string;
  name: string;
  bankName: string | null;
  currency: string;
  isActive: boolean;
}

interface MatchCandidate {
  documentId: string;
  documentNumber: string | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  grossAmount: number | null;
  currency: string | null;
  invoiceDate: string | null;
  confidence: number;
  method: string;
}

// ── Page ──

export default function BankReconciliationPage() {
  const { capabilities } = useCompany();
  const [tab, setTab] = useState("unmatched");
  const [unmatchedTxs, setUnmatchedTxs] = useState<BankTransaction[]>([]);
  const [matchedTxs, setMatchedTxs] = useState<BankTransaction[]>([]);
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [unmatchedCount, setUnmatchedCount] = useState(0);

  // Import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // Match dialog
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchingTx, setMatchingTx] = useState<BankTransaction | null>(null);
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidate[]>([]);
  const [matchSearch, setMatchSearch] = useState("");
  const [matchSearchResults, setMatchSearchResults] = useState<MatchCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  // Account dialog
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [accountForm, setAccountForm] = useState({ name: "", iban: "", bankName: "", currency: "CHF" });
  const canMutateBank = capabilities?.canMutate?.bank ?? false;
  const activeAccountsCount = accounts.filter((account) => account.isActive).length;

  // ── Data Loading ──

  const loadUnmatched = useCallback(async () => {
    const res = await fetch("/api/bank/transactions?matchStatus=unmatched&pageSize=100");
    if (res.ok) {
      const data = await res.json();
      setUnmatchedTxs(data.transactions);
      setUnmatchedCount(data.pagination.total);
    }
  }, []);

  const loadMatched = useCallback(async () => {
    const res = await fetch("/api/bank/transactions?matchStatus=auto_matched&pageSize=50");
    const res2 = await fetch("/api/bank/transactions?matchStatus=manual_matched&pageSize=50");
    if (res.ok && res2.ok) {
      const d1 = await res.json();
      const d2 = await res2.json();
      setMatchedTxs([...d1.transactions, ...d2.transactions].sort(
        (a: any, b: any) => new Date(b.matchedAt || b.bookingDate).getTime() - new Date(a.matchedAt || a.bookingDate).getTime()
      ));
    }
  }, []);

  const loadStatements = useCallback(async () => {
    const res = await fetch("/api/bank/statements");
    if (res.ok) setStatements(await res.json());
  }, []);

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/bank/accounts");
    if (res.ok) setAccounts(await res.json());
  }, []);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await Promise.all([loadUnmatched(), loadMatched(), loadStatements(), loadAccounts()]);
      setLoading(false);
    }
    loadAll();
  }, [loadUnmatched, loadMatched, loadStatements, loadAccounts]);

  // ── Import Handler ──

  async function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canMutateBank) {
      toast.error(de.errors.forbidden);
      return;
    }
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/bank/import", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const data = await res.json();
      toast.success(
        de.bank.importSummary
          .replace("{statements}", String(data.statements.length))
          .replace("{matched}", String(data.matching.matched))
          .replace("{unmatched}", String(data.matching.unmatched))
      );
      setImportOpen(false);
      await Promise.all([loadUnmatched(), loadMatched(), loadStatements(), loadAccounts()]);
    } catch (err: any) {
      toast.error(err.message || de.bank.importError);
    } finally {
      setImporting(false);
    }
  }

  // ── Match Handler ──

  async function openMatchDialog(tx: BankTransaction) {
    setMatchingTx(tx);
    setMatchDialogOpen(true);
    setMatchSearch("");
    setMatchSearchResults([]);
    setCandidatesLoading(true);
    try {
      const res = await fetch(`/api/bank/transactions/${tx.id}/candidates`);
      if (res.ok) {
        const data = await res.json();
        setMatchCandidates(data.candidates);
      }
    } finally {
      setCandidatesLoading(false);
    }
  }

  async function searchCandidates(search: string) {
    setMatchSearch(search);
    if (!matchingTx || search.trim().length < 2) {
      setMatchSearchResults([]);
      return;
    }
    const res = await fetch(`/api/bank/transactions/${matchingTx.id}/candidates?search=${encodeURIComponent(search)}`);
    if (res.ok) {
      const data = await res.json();
      setMatchSearchResults(data.searchResults);
    }
  }

  async function confirmMatch(documentId: string) {
    if (!matchingTx) return;
    const res = await fetch(`/api/bank/transactions/${matchingTx.id}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    if (res.ok) {
      toast.success(de.bank.assign);
      setMatchDialogOpen(false);
      await Promise.all([loadUnmatched(), loadMatched()]);
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error || de.common.error);
    }
  }

  async function setNoMatch(txId: string) {
    if (!canMutateBank) {
      toast.error(de.errors.forbidden);
      return;
    }
    const res = await fetch(`/api/bank/transactions/${txId}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noMatch: true }),
    });
    if (res.ok) {
      toast.success(de.bank.noMatch);
      await loadUnmatched();
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error || de.common.error);
    }
  }

  // ── Account CRUD ──

  function openAccountDialog(account?: BankAccount) {
    if (account) {
      setEditingAccount(account);
      setAccountForm({ name: account.name, iban: account.iban, bankName: account.bankName || "", currency: account.currency });
    } else {
      setEditingAccount(null);
      setAccountForm({ name: "", iban: "", bankName: "", currency: "CHF" });
    }
    setAccountDialogOpen(true);
  }

  async function saveAccount() {
    if (!canMutateBank) {
      toast.error(de.errors.forbidden);
      return;
    }
    if (!accountForm.name || !accountForm.iban) return;
    if (editingAccount) {
      const res = await fetch(`/api/bank/accounts/${editingAccount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountForm),
      });
      if (res.ok) {
        toast.success(de.bank.bankAccounts.saveSuccess);
        setAccountDialogOpen(false);
        await loadAccounts();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || de.common.error);
      }
    } else {
      const res = await fetch("/api/bank/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountForm),
      });
      if (res.ok) {
        toast.success(de.bank.bankAccounts.saveSuccess);
        setAccountDialogOpen(false);
        await loadAccounts();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || de.common.error);
      }
    }
  }

  // ── Render ──

  return (
    <div className="space-y-6 p-6">
      <EntityHeader
        title={de.bank.title}
        badge={
          unmatchedCount > 0 ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              {unmatchedCount} {de.bank.openTransactions}
            </Badge>
          ) : undefined
        }
        primaryAction={canMutateBank ? {
          label: de.bank.importCamt,
          icon: Upload,
          onClick: () => setImportOpen(true),
        } : undefined}
        secondaryActions={canMutateBank ? [{
          label: de.bank.addAccount,
          icon: Plus,
          onClick: () => openAccountDialog(),
          variant: "outline",
        }] : undefined}
      />

      <FirstUseHint
        id="bank-intro"
        title={de.bank.setupHintTitle}
        description={de.bank.setupHintDescription}
      />

      {!canMutateBank && (
        <InfoPanel tone="info" icon={Landmark}>
          <p className="text-sm">{de.bank.readOnlyDescription}</p>
        </InfoPanel>
      )}

      {!loading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SectionCard bodyClassName="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {de.bank.tabs.unmatched}
              </p>
              <Landmark className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-3xl font-semibold tracking-tight">{unmatchedCount}</p>
            <p className="text-sm text-muted-foreground">{de.bank.openTransactions}</p>
          </SectionCard>

          <SectionCard bodyClassName="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {de.bank.tabs.matched}
              </p>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-3xl font-semibold tracking-tight">{matchedTxs.length}</p>
            <p className="text-sm text-muted-foreground">{de.bank.matchedDoc}</p>
          </SectionCard>

          <SectionCard bodyClassName="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {de.bank.tabs.statements}
              </p>
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-3xl font-semibold tracking-tight">{statements.length}</p>
            <p className="text-sm text-muted-foreground">{de.bank.importCamt}</p>
          </SectionCard>

          <SectionCard bodyClassName="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {de.bank.tabs.accounts}
              </p>
              <Wallet className="h-4 w-4 text-violet-600" />
            </div>
            <p className="text-3xl font-semibold tracking-tight">{activeAccountsCount}</p>
            <p className="text-sm text-muted-foreground">{de.bank.bankAccounts.active}</p>
          </SectionCard>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="unmatched">
            {de.bank.tabs.unmatched}
            {unmatchedCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 bg-amber-100 text-amber-800 text-[10px] h-4 px-1">
                {unmatchedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="matched">{de.bank.tabs.matched}</TabsTrigger>
          <TabsTrigger value="statements">{de.bank.tabs.statements}</TabsTrigger>
          <TabsTrigger value="accounts">{de.bank.tabs.accounts}</TabsTrigger>
        </TabsList>

        {/* ── Tab: Ungeklärt ── */}
        <TabsContent value="unmatched">
          <div className="border rounded-md bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{de.bank.date}</TableHead>
                  <TableHead className="text-right">{de.bank.amount}</TableHead>
                  <TableHead>{de.bank.counterparty}</TableHead>
                  <TableHead>{de.bank.reference}</TableHead>
                  <TableHead>{de.bank.suggestedDoc}</TableHead>
                  <TableHead>{de.bank.action}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : unmatchedTxs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState icon={Landmark} title={de.bank.noTransactions} description="" />
                    </TableCell>
                  </TableRow>
                ) : (
                  unmatchedTxs.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(tx.bookingDate)}</TableCell>
                      <TableCell className={`text-right whitespace-nowrap font-mono ${tx.isCredit ? "text-green-700" : "text-red-700"}`}>
                        {tx.isCredit ? "+" : "-"}{formatCurrency(tx.amount, tx.currency)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{tx.counterpartyName || de.common.noData}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                        {tx.paymentReference || tx.remittanceInfo || de.common.noData}
                      </TableCell>
                      <TableCell>
                        <SuggestedDocCell txId={tx.id} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => openMatchDialog(tx)} disabled={!canMutateBank}>
                            {de.bank.assign}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setNoMatch(tx.id)} disabled={!canMutateBank}>
                            {de.bank.noMatch}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Tab: Zugeordnet ── */}
        <TabsContent value="matched">
          <div className="border rounded-md bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{de.bank.date}</TableHead>
                  <TableHead className="text-right">{de.bank.amount}</TableHead>
                  <TableHead>{de.bank.counterparty}</TableHead>
                  <TableHead>{de.bank.matchedDoc}</TableHead>
                  <TableHead>{de.bank.matchMethodLabel}</TableHead>
                  <TableHead>{de.bank.matchedAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : matchedTxs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState icon={Landmark} title={de.bank.noTransactions} description="" />
                    </TableCell>
                  </TableRow>
                ) : (
                  matchedTxs.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(tx.bookingDate)}</TableCell>
                      <TableCell className={`text-right whitespace-nowrap font-mono ${tx.isCredit ? "text-green-700" : "text-red-700"}`}>
                        {tx.isCredit ? "+" : "-"}{formatCurrency(tx.amount, tx.currency)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{tx.counterpartyName || de.common.noData}</TableCell>
                      <TableCell>
                        {tx.matchedDoc ? (
                          <Link href={`/documents/${tx.matchedDoc.id}`} className="text-blue-600 hover:underline text-sm">
                            {tx.matchedDoc.documentNumber || tx.matchedDoc.supplierNameNormalized || de.bank.matchedDoc}
                          </Link>
                        ) : de.common.noData}
                      </TableCell>
                      <TableCell>
                        {tx.matchMethod && <StatusBadge type="matchMethod" value={tx.matchMethod} size="sm" />}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {tx.matchedAt ? formatDate(tx.matchedAt) : de.common.noData}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Tab: Kontoauszüge ── */}
        <TabsContent value="statements">
          <div className="border rounded-md bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{de.bank.statements.fileName}</TableHead>
                  <TableHead>{de.bank.statements.iban}</TableHead>
                  <TableHead>{de.bank.statements.period}</TableHead>
                  <TableHead className="text-right">{de.bank.statements.openingBalance}</TableHead>
                  <TableHead className="text-right">{de.bank.statements.closingBalance}</TableHead>
                  <TableHead className="text-right">{de.bank.statements.transactions}</TableHead>
                  <TableHead className="text-right">{de.bank.statements.matched}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : statements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <EmptyState icon={FileText} title={de.emptyStates.bank.title} description={de.emptyStates.bank.description} />
                    </TableCell>
                  </TableRow>
                ) : (
                  statements.map((stmt) => (
                    <TableRow key={stmt.id}>
                      <TableCell className="text-sm">{stmt.fileName || de.common.noData}</TableCell>
                      <TableCell className="font-mono text-xs">{stmt.bankAccount.iban}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(stmt.fromDate)} – {formatDate(stmt.toDate)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(stmt.openingBalance, "CHF")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(stmt.closingBalance, "CHF")}
                      </TableCell>
                      <TableCell className="text-right">{stmt.transactionCount}</TableCell>
                      <TableCell className="text-right">
                        {stmt.matchedCount}/{stmt.transactionCount}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Tab: Bankkonten ── */}
        <TabsContent value="accounts">
          <div className="border rounded-md bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{de.bank.bankAccounts.iban}</TableHead>
                  <TableHead>{de.bank.bankAccounts.name}</TableHead>
                  <TableHead>{de.bank.bankAccounts.bankName}</TableHead>
                  <TableHead>{de.bank.bankAccounts.currency}</TableHead>
                  <TableHead>{de.bank.bankAccounts.active}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <div className="py-6 px-4">
                        <InfoPanel tone="info" icon={Landmark}>
                          <strong>{de.bank.title}</strong>
                          <p className="text-sm mt-1">
                            {de.bank.setupHintDescription}
                          </p>
                        </InfoPanel>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((acc) => (
                    <TableRow
                      key={acc.id}
                      className={canMutateBank ? "cursor-pointer hover:bg-muted/50" : ""}
                      onClick={() => {
                        if (canMutateBank) openAccountDialog(acc);
                      }}
                    >
                      <TableCell className="font-mono text-xs">{acc.iban}</TableCell>
                      <TableCell>{acc.name}</TableCell>
                      <TableCell className="text-muted-foreground">{acc.bankName || de.common.noData}</TableCell>
                      <TableCell>{acc.currency}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={acc.isActive ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}>
                          {acc.isActive ? de.bank.bankAccounts.active : de.bank.bankAccounts.inactive}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!canMutateBank}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canMutateBank) openAccountDialog(acc);
                          }}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Import Dialog ── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{de.bank.importCamt}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleImport}>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="file">{de.bank.importDialogLabel}</Label>
                <Input id="file" name="file" type="file" accept=".xml,.XML" required />
              </div>
            </div>
            <DialogFooter>
              <DialogClose><Button type="button" variant="outline">{de.common.cancel}</Button></DialogClose>
              <Button type="submit" disabled={importing}>
                {importing ? de.bank.importing : de.bank.importCamt}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Match Dialog ── */}
      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{de.bank.matchDialog.title}</DialogTitle>
          </DialogHeader>
          {matchingTx && (
            <div className="text-sm text-muted-foreground mb-2">
              {formatDate(matchingTx.bookingDate)} · {formatCurrency(matchingTx.amount, matchingTx.currency)} · {matchingTx.counterpartyName || de.common.noData}
            </div>
          )}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={de.bank.matchDialog.searchPlaceholder}
                value={matchSearch}
                onChange={(e) => searchCandidates(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{de.bank.matchDialog.suggestedMatches}</p>
              {candidatesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : matchCandidates.length === 0 && matchSearchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{de.bank.matchDialog.noSuggestions}</p>
              ) : (
                <div className="max-h-[300px] overflow-y-auto space-y-1">
                  {[...matchCandidates, ...matchSearchResults].map((c) => (
                    <button
                      key={c.documentId}
                      className="w-full text-left p-2 rounded-md hover:bg-muted/50 flex items-center justify-between"
                      onClick={() => confirmMatch(c.documentId)}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {c.documentNumber || c.invoiceNumber || de.bank.matchedDoc} · {c.supplierName || de.common.noData}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.invoiceDate ? formatDate(c.invoiceDate) : de.common.noData} · {c.grossAmount != null ? formatCurrency(c.grossAmount, c.currency || "CHF") : de.common.noData}
                        </div>
                      </div>
                      {c.confidence > 0 && (
                        <ConfidenceBadge level={c.confidence >= 0.8 ? "high" : c.confidence >= 0.5 ? "medium" : "low"} compact />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Account Dialog ── */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? de.bank.bankAccounts.editTitle : de.bank.bankAccounts.createTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{de.bank.bankAccounts.name}</Label>
              <Input value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} />
            </div>
            <div>
              <Label>{de.bank.bankAccounts.iban}</Label>
              <Input
                value={accountForm.iban}
                onChange={(e) => setAccountForm({ ...accountForm, iban: e.target.value })}
                placeholder={de.bank.bankAccounts.ibanPlaceholder}
              />
            </div>
            <div>
              <Label>{de.bank.bankAccounts.bankName}</Label>
              <Input value={accountForm.bankName} onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })} />
            </div>
            <div>
              <Label>{de.bank.bankAccounts.currency}</Label>
              <Input value={accountForm.currency} onChange={(e) => setAccountForm({ ...accountForm, currency: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={saveAccount} disabled={!accountForm.name || !accountForm.iban}>
              {de.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Suggested Document Cell ──

function SuggestedDocCell({ txId }: { txId: string }) {
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/bank/transactions/${txId}/candidates`)
      .then((r) => r.ok ? r.json() : { candidates: [] })
      .then((data) => {
        setCandidates(data.candidates?.filter((c: MatchCandidate) => c.confidence > 0.6) || []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [txId]);

  if (!loaded) return <Skeleton className="h-4 w-20" />;
  if (candidates.length === 0) return <span className="text-muted-foreground">—</span>;

  const best = candidates[0];
  return (
    <Link href={`/documents/${best.documentId}`} className="text-blue-600 hover:underline text-sm inline-flex items-center gap-1">
                        {best.documentNumber || best.supplierName || de.bank.matchedDoc}
      <ConfidenceBadge level={best.confidence >= 0.8 ? "high" : "medium"} compact />
    </Link>
  );
}
