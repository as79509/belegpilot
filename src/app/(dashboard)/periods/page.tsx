"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  CalendarCheck, Lock, CheckCircle2, XCircle,
  MessageSquare, Loader2, Unlock, Square, ArrowRight,
} from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatCurrency } from "@/lib/i18n/format";
import { toast } from "sonner";
import Link from "next/link";
import { EntityHeader, FilterBar, StatusBadge, EmptyState, InfoPanel } from "@/components/ds";

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [statusFilterValue, setStatusFilterValue] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [periodActions, setPeriodActions] = useState<any[]>([]);

  const fetchPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/periods?year=${year}`);
      if (res.ok) setPeriods(await res.json());
    } catch {} finally { setLoading(false); }
  }, [year]);

  useEffect(() => { fetchPeriods(); }, [fetchPeriods]);

  async function openDetail(p: any) {
    setSelectedPeriod(p);
    setDetailOpen(true);
    setDetailLoading(true);
    setNote(p.notes || "");
    setPeriodActions([]);
    try {
      // Ensure period exists in DB
      let periodId = p.id;
      if (!periodId) {
        const createRes = await fetch("/api/periods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year: p.year, month: p.month }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          periodId = created.id;
          setSelectedPeriod(created);
        }
      }
      if (periodId) {
        const [detailRes, actionsRes] = await Promise.all([
          fetch(`/api/periods/${periodId}/detail`),
          fetch(`/api/next-actions?scope=period&id=${periodId}`).catch(() => null),
        ]);
        if (detailRes.ok) setDetail(await detailRes.json());
        if (actionsRes?.ok) {
          const actionsData = await actionsRes.json();
          setPeriodActions(Array.isArray(actionsData?.actions) ? actionsData.actions : []);
        }
      }
    } catch (err) {
      console.error("[Periods] Detail load error:", err);
    } finally { setDetailLoading(false); }
  }

  async function changeStatus(newStatus: string) {
    if (!selectedPeriod?.id) return;
    if (newStatus === "locked" && !confirm(de.periods.lockConfirm)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/periods/${selectedPeriod.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || de.errors.serverError);
        return;
      }
      const updated = await res.json();
      setSelectedPeriod(updated);
      toast.success(de.periodDetail.statusChanged);
      fetchPeriods();
      // Reload detail
      const detailRes = await fetch(`/api/periods/${updated.id}/detail`);
      if (detailRes.ok) setDetail(await detailRes.json());
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function saveNote() {
    if (!selectedPeriod?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/periods/${selectedPeriod.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: note }),
      });
      if (res.ok) {
        toast.success(de.settings.saved);
        const updated = await res.json();
        setSelectedPeriod(updated);
      }
    } catch {} finally { setSaving(false); }
  }

  const visiblePeriods = statusFilterValue
    ? periods.filter((p: any) => p.status === statusFilterValue)
    : periods;

  const periodStatusOptions = Object.entries(de.periods.status).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <div className="space-y-6">
      <EntityHeader title={de.periods.title} />

      <FilterBar
        filters={[
          {
            key: "year",
            label: "Jahr",
            value: String(year),
            onChange: (v) => setYear(parseInt(v) || new Date().getFullYear()),
            options: [2025, 2026, 2027].map((y) => ({ value: String(y), label: String(y) })),
          },
          {
            key: "status",
            label: "Status",
            value: statusFilterValue,
            onChange: setStatusFilterValue,
            options: periodStatusOptions,
          },
        ]}
        onClear={() => setStatusFilterValue("")}
      />

      {loading ? (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : visiblePeriods.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="Keine Perioden gefunden" description="Wählen Sie ein anderes Jahr oder passen Sie den Filter an" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {visiblePeriods.map((p: any) => (
            <Card
              key={p.month}
              className={`cursor-pointer hover:ring-2 hover:ring-blue-300 transition-shadow ${p.status === "locked" ? "opacity-60" : ""}`}
              onClick={() => openDetail(p)}
            >
              <CardContent className="pt-3 pb-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{MONTHS[p.month - 1]}</span>
                  <StatusBadge type="period" value={p.status} />
                </div>

                <div className="text-xs space-y-0.5">
                  {[
                    { key: "documentsComplete", done: p.documentsReceived > 0 },
                    { key: "recurringGenerated", done: p.recurringGenerated },
                    { key: "depreciationDone", done: p.depreciationGenerated },
                    { key: "vatChecked", done: p.vatChecked },
                    { key: "exportDone", done: p.exportCompleted },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center gap-1">
                      {item.done ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-gray-300" />}
                      <span className={item.done ? "" : "text-muted-foreground"}>
                        {de.periods.checklist[item.key as keyof typeof de.periods.checklist]}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground">
                  {de.periods.documentsProgress}: {p.documentsReceived}/{p.documentsExpected || "?"}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Period Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <CalendarCheck className="h-5 w-5" />
              {selectedPeriod && `${MONTHS[selectedPeriod.month - 1]} ${selectedPeriod.year}`}
              {selectedPeriod && (
                <StatusBadge type="period" value={selectedPeriod.status} />
              )}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-32" />
              <Skeleton className="h-20" />
            </div>
          ) : detail ? (
            <div className="space-y-5">
              {/* Doc stats bar */}
              <div>
                <p className="text-xs font-medium mb-1.5">{de.periodDetail.docStats}</p>
                <div className="flex gap-3 text-xs">
                  <span className="text-green-700">{detail.stats.readyDocs} {de.periodDetail.allReady}</span>
                  <span className="text-orange-700">{detail.stats.needsReviewDocs} Prüfung</span>
                  <span className="text-red-700">{detail.stats.failedDocs} Fehler</span>
                  <span className="text-blue-700">{detail.stats.exportedDocs} exportiert</span>
                </div>
                {detail.stats.totalDocs > 0 && (
                  <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 mt-1.5">
                    <div className="bg-green-500" style={{ width: `${(detail.stats.readyDocs / detail.stats.totalDocs) * 100}%` }} />
                    <div className="bg-orange-400" style={{ width: `${(detail.stats.needsReviewDocs / detail.stats.totalDocs) * 100}%` }} />
                    <div className="bg-red-400" style={{ width: `${(detail.stats.failedDocs / detail.stats.totalDocs) * 100}%` }} />
                  </div>
                )}
              </div>

              {/* Live checklist */}
              <div>
                <p className="text-xs font-medium mb-1.5">{de.periodDetail.checklist}</p>
                <div className="space-y-1.5">
                  {detail.checklist.map((item: any) => (
                    <div key={item.key} className={`flex items-center gap-2 text-sm p-1.5 rounded ${!item.done ? "bg-red-50" : ""}`}>
                      {item.done
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                      <span className={!item.done ? "text-red-700" : ""}>{item.label}</span>
                      {item.detail && (
                        <span className="text-xs text-muted-foreground ml-auto">{item.detail}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Actions Checklist */}
              {periodActions.length > 0 && (
                <Card>
                  <CardContent className="py-3">
                    <p className="text-xs font-medium mb-2">
                      {de.nextActions.periodSteps}
                      {selectedPeriod && `: ${MONTHS[selectedPeriod.month - 1]} ${selectedPeriod.year}`}
                    </p>
                    <div className="space-y-1">
                      {periodActions.map((action: any, i: number) => {
                        const isReady = action.type === "close_period";
                        return (
                          <Link
                            key={`${action.type}-${i}`}
                            href={action.targetUrl}
                            className={`flex items-center gap-2 text-sm p-1.5 rounded transition-colors ${
                              isReady
                                ? "bg-green-50 hover:bg-green-100 text-green-800"
                                : "hover:bg-muted"
                            }`}
                          >
                            {isReady ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <span className="flex-1 min-w-0 truncate">{action.title}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          </Link>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Blockers */}
              {detail.blockers.length > 0 ? (
                <InfoPanel
                  tone="error"
                  title={`${detail.blockers.length} ${de.periodDetail.blockerCount}: ${de.periodDetail.blockers}`}
                >
                  <ul className="space-y-1 ml-1 list-disc list-inside">
                    {detail.blockers.map((b: string, i: number) => <li key={i}>{b}</li>)}
                  </ul>
                </InfoPanel>
              ) : (
                <InfoPanel tone="success" title={de.periodDetail.noBlockers} />
              )}

              {/* Expected documents — missing or mismatched */}
              {detail.expectedDocs?.details?.filter((d: any) => d.status === "missing" || d.status === "amount_mismatch").length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1.5">{de.periodDetail.missingDocs}</p>
                  <div className="space-y-1">
                    {detail.expectedDocs.details
                      .filter((d: any) => d.status === "missing" || d.status === "amount_mismatch")
                      .map((ed: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm p-1.5 bg-amber-50 rounded">
                          <div>
                            <span className="text-amber-800">{ed.name} ({ed.counterparty})</span>
                            {ed.expectedAmount && <span className="text-xs text-muted-foreground ml-2">{formatCurrency(ed.expectedAmount, "CHF")}</span>}
                            {ed.status === "amount_mismatch" && <Badge variant="secondary" className="ml-2 text-xs bg-amber-100 text-amber-800">Betrag abweichend</Badge>}
                          </div>
                          <Link href={`/tasks/new?title=${encodeURIComponent(ed.name + " fehlt")}`}>
                            <Button variant="ghost" size="sm" className="text-xs h-6">
                              <MessageSquare className="h-3 w-3 mr-1" />{de.periodDetail.askClient}
                            </Button>
                          </Link>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Fallback: Missing contract docs (for companies without expected docs) */}
              {(!detail.expectedDocs || detail.expectedDocs.total === 0) && detail.missingContractDocs.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1.5">{de.periodDetail.missingDocs}</p>
                  <div className="space-y-1">
                    {detail.missingContractDocs.map((mc: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm p-1.5 bg-amber-50 rounded">
                        <span className="text-amber-800">{mc.contractName} ({mc.counterparty})</span>
                        <Link href={`/tasks/new?title=${encodeURIComponent(mc.contractName + " fehlt")}`}>
                          <Button variant="ghost" size="sm" className="text-xs h-6">
                            <MessageSquare className="h-3 w-3 mr-1" />{de.periodDetail.askClient}
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Open tasks */}
              {detail.openTasks.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1.5">{de.periodDetail.openTasksForPeriod}</p>
                  <div className="space-y-1">
                    {detail.openTasks.map((t: any) => (
                      <Link key={t.id} href={`/tasks`} className="flex items-center gap-2 text-sm p-1.5 hover:bg-muted rounded">
                        <Badge variant="outline" className="text-xs">{de.tasksMgmt.priorities[t.priority] || t.priority}</Badge>
                        <span>{t.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <p className="text-xs font-medium mb-1.5">{de.periodDetail.addNote}</p>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={de.periods.notes} />
                <Button variant="outline" size="sm" className="mt-1.5" onClick={saveNote} disabled={saving}>
                  {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  {de.common.save}
                </Button>
              </div>

              {/* Status change dropdown */}
              <div>
                <p className="text-xs font-medium mb-1.5">Status ändern</p>
                <select
                  className="border rounded-md px-3 py-1.5 text-sm bg-white w-full"
                  value={selectedPeriod?.status || "open"}
                  onChange={(e) => changeStatus(e.target.value)}
                  disabled={saving}
                >
                  {Object.entries(de.periods.status).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                {detail.blockers.length === 0 && selectedPeriod?.status !== "closed" && selectedPeriod?.status !== "locked" && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => changeStatus("closed")}
                    disabled={saving}
                  >
                    {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    <CheckCircle2 className="h-4 w-4 mr-1" />{de.periodDetail.closePeriod}
                  </Button>
                )}
                {selectedPeriod?.status === "closed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatus("locked")}
                    disabled={saving}
                  >
                    <Lock className="h-4 w-4 mr-1" />{de.periodDetail.lockPeriod}
                  </Button>
                )}
                {selectedPeriod?.status === "locked" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatus("closed")}
                    disabled={saving}
                  >
                    <Unlock className="h-4 w-4 mr-1" />{de.periodDetail.unlockPeriod}
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
