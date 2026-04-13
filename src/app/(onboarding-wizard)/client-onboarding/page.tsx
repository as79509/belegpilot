"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
  Briefcase,
  Calculator,
  Sparkles,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { de } from "@/lib/i18n/de";

// Step definitions
const STEPS = [
  {
    id: "welcome",
    title: "Willkommen bei BelegPilot",
    subtitle: "Lassen Sie uns Ihren neuen Mandanten einrichten. Es dauert nur wenige Minuten.",
    icon: Building2,
  },
  {
    id: "company-name",
    title: "Wie heisst das Unternehmen?",
    subtitle: "Der offizielle Name, wie er im Handelsregister eingetragen ist.",
    icon: Building2,
  },
  {
    id: "legal-form",
    title: "Welche Rechtsform hat das Unternehmen?",
    subtitle: "Dies hilft uns bei der korrekten Buchhaltungseinrichtung.",
    icon: Building2,
  },
  {
    id: "industry",
    title: "In welcher Branche ist das Unternehmen taetig?",
    subtitle: "Wir passen die KI-Vorschlaege entsprechend an.",
    icon: Briefcase,
  },
  {
    id: "business-model",
    title: "Beschreiben Sie kurz das Geschaeftsmodell",
    subtitle: "Wie verdient das Unternehmen Geld? Diese Info hilft der KI bei der Belegverarbeitung.",
    icon: Briefcase,
  },
  {
    id: "vat",
    title: "Ist das Unternehmen mehrwertsteuerpflichtig?",
    subtitle: "Konfigurieren Sie die MwSt-Einstellungen.",
    icon: Calculator,
  },
  {
    id: "fiscal-year",
    title: "Wann beginnt das Geschaeftsjahr?",
    subtitle: "Wir richten die Perioden entsprechend ein.",
    icon: Calculator,
  },
  {
    id: "ai-settings",
    title: "Wie autonom soll die KI arbeiten?",
    subtitle: "Sie koennen diese Einstellung spaeter jederzeit aendern.",
    icon: Sparkles,
  },
  {
    id: "summary",
    title: "Alles bereit!",
    subtitle: "Ueberpruefen Sie die Angaben und schliessen Sie die Einrichtung ab.",
    icon: Check,
  },
];

const LEGAL_FORMS = [
  { value: "einzelfirma", label: "Einzelfirma" },
  { value: "gmbh", label: "GmbH" },
  { value: "ag", label: "AG" },
  { value: "kollektiv", label: "Kollektivgesellschaft" },
  { value: "verein", label: "Verein" },
  { value: "stiftung", label: "Stiftung" },
  { value: "genossenschaft", label: "Genossenschaft" },
];

const INDUSTRIES = [
  { value: "gastro", label: "Gastgewerbe & Hotellerie" },
  { value: "handel", label: "Handel & Detailhandel" },
  { value: "bau", label: "Baugewerbe" },
  { value: "it", label: "IT & Technologie" },
  { value: "gesundheit", label: "Gesundheitswesen" },
  { value: "finanz", label: "Finanzdienstleistungen" },
  { value: "immobilien", label: "Immobilien" },
  { value: "transport", label: "Transport & Logistik" },
  { value: "bildung", label: "Bildung" },
  { value: "produktion", label: "Produktion & Industrie" },
  { value: "beratung", label: "Beratung & Dienstleistung" },
  { value: "andere", label: "Andere" },
];

const AI_LEVELS = [
  {
    value: "conservative",
    threshold: 0.8,
    label: "Konservativ",
    description: "Mehr manuelle Pruefung, hoechste Genauigkeit",
  },
  {
    value: "balanced",
    threshold: 0.65,
    label: "Ausgewogen",
    description: "Empfohlen fuer die meisten Unternehmen",
  },
  {
    value: "autonomous",
    threshold: 0.5,
    label: "Autonom",
    description: "Maximale Automatisierung, weniger Kontrolle",
  },
];

const MONTHS = [
  "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

interface FormData {
  name: string;
  legalName: string;
  legalForm: string;
  industry: string;
  businessModel: string;
  vatNumber: string;
  vatLiable: boolean;
  vatMethod: string;
  vatInterval: string;
  fiscalYearStart: number;
  aiLevel: string;
  aiConfidenceThreshold: number;
}

export default function ClientOnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    legalName: "",
    legalForm: "",
    industry: "",
    businessModel: "",
    vatNumber: "",
    vatLiable: true,
    vatMethod: "effektiv",
    vatInterval: "quarterly",
    fiscalYearStart: 1,
    aiLevel: "balanced",
    aiConfidenceThreshold: 0.65,
  });

  const progress = ((currentStep) / (STEPS.length - 1)) * 100;
  const step = STEPS[currentStep];

  const updateField = useCallback((field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const canProceed = useCallback(() => {
    switch (step.id) {
      case "welcome":
        return true;
      case "company-name":
        return formData.name.trim().length >= 2;
      case "legal-form":
        return formData.legalForm !== "";
      case "industry":
        return formData.industry !== "";
      case "business-model":
        return true; // Optional
      case "vat":
        return true;
      case "fiscal-year":
        return true;
      case "ai-settings":
        return true;
      case "summary":
        return true;
      default:
        return true;
    }
  }, [step.id, formData]);

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1 && canProceed()) {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, canProceed]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && canProceed() && currentStep < STEPS.length - 1) {
        handleNext();
      }
    },
    [canProceed, handleNext, currentStep]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        legalName: formData.legalName || formData.name,
        legalForm: formData.legalForm,
        industry: formData.industry,
        businessModel: formData.businessModel,
        vatNumber: formData.vatNumber,
        vatLiable: formData.vatLiable,
        vatMethod: formData.vatMethod,
        vatInterval: formData.vatInterval,
        fiscalYearStart: formData.fiscalYearStart,
        aiConfidenceThreshold: formData.aiConfidenceThreshold,
        currency: "CHF",
      };

      const res = await fetch("/api/trustee/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Fehler beim Erstellen");
      }

      toast.success("Mandant erfolgreich erstellt!");
      router.push("/trustee/clients");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExit = () => {
    if (formData.name) {
      // Could save draft here
      toast.info("Entwurf wurde nicht gespeichert");
    }
    router.push("/trustee/clients");
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 100 : -100,
      opacity: 0,
    }),
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header with progress */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExit}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
            <span className="ml-2 hidden sm:inline">Beenden</span>
          </Button>

          <div className="flex-1 max-w-md mx-4">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-foreground rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              />
            </div>
          </div>

          <div className="text-sm text-muted-foreground w-20 text-right">
            {currentStep + 1} / {STEPS.length}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="space-y-8"
            >
              {/* Step header */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-2">
                  <step.icon className="h-6 w-6 text-foreground" />
                </div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-balance">
                  {step.title}
                </h1>
                <p className="text-muted-foreground text-base md:text-lg">
                  {step.subtitle}
                </p>
              </div>

              {/* Step content */}
              <div className="space-y-6">
                {step.id === "welcome" && (
                  <div className="text-center space-y-6">
                    <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                      {[
                        { icon: Building2, label: "Firmendaten" },
                        { icon: Calculator, label: "Buchhaltung" },
                        { icon: Sparkles, label: "KI-Setup" },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/50"
                        >
                          <item.icon className="h-6 w-6 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {step.id === "company-name" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium">
                        Firmenname
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        placeholder="z.B. Muster GmbH"
                        className="h-12 text-lg"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="legalName" className="text-sm font-medium">
                        Rechtlicher Name (optional)
                      </Label>
                      <Input
                        id="legalName"
                        value={formData.legalName}
                        onChange={(e) => updateField("legalName", e.target.value)}
                        placeholder="Falls abweichend vom Firmennamen"
                        className="h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vatNumber" className="text-sm font-medium">
                        UID / MwSt-Nummer (optional)
                      </Label>
                      <Input
                        id="vatNumber"
                        value={formData.vatNumber}
                        onChange={(e) => updateField("vatNumber", e.target.value)}
                        placeholder="CHE-xxx.xxx.xxx"
                        className="h-12"
                      />
                    </div>
                  </div>
                )}

                {step.id === "legal-form" && (
                  <div className="grid grid-cols-2 gap-3">
                    {LEGAL_FORMS.map((form) => (
                      <button
                        key={form.value}
                        type="button"
                        onClick={() => updateField("legalForm", form.value)}
                        className={cn(
                          "p-4 rounded-xl border-2 text-left transition-all",
                          "hover:border-foreground/50 hover:bg-muted/50",
                          formData.legalForm === form.value
                            ? "border-foreground bg-muted"
                            : "border-border"
                        )}
                      >
                        <span className="font-medium">{form.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {step.id === "industry" && (
                  <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                    {INDUSTRIES.map((ind) => (
                      <button
                        key={ind.value}
                        type="button"
                        onClick={() => updateField("industry", ind.value)}
                        className={cn(
                          "p-4 rounded-xl border-2 text-left transition-all",
                          "hover:border-foreground/50 hover:bg-muted/50",
                          formData.industry === ind.value
                            ? "border-foreground bg-muted"
                            : "border-border"
                        )}
                      >
                        <span className="font-medium">{ind.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {step.id === "business-model" && (
                  <div className="space-y-2">
                    <Label htmlFor="businessModel" className="text-sm font-medium">
                      Geschaeftsmodell (optional)
                    </Label>
                    <Textarea
                      id="businessModel"
                      value={formData.businessModel}
                      onChange={(e) => updateField("businessModel", e.target.value)}
                      placeholder="Beschreiben Sie kurz, wie das Unternehmen Einnahmen erzielt. z.B. 'Softwareentwicklung fuer KMU, hauptsaechlich Projektarbeit und Wartungsvertraege'"
                      rows={4}
                      className="text-base resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Diese Information hilft der KI, Belege korrekt zu kategorisieren
                    </p>
                  </div>
                )}

                {step.id === "vat" && (
                  <div className="space-y-6">
                    <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-border cursor-pointer hover:border-foreground/50 transition-colors">
                      <Checkbox
                        checked={formData.vatLiable}
                        onCheckedChange={(c) => updateField("vatLiable", !!c)}
                        className="h-5 w-5"
                      />
                      <div>
                        <span className="font-medium">Mehrwertsteuerpflichtig</span>
                        <p className="text-sm text-muted-foreground">
                          Das Unternehmen ist bei der ESTV registriert
                        </p>
                      </div>
                    </label>

                    {formData.vatLiable && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Abrechnungsmethode</Label>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { value: "effektiv", label: "Effektiv" },
                              { value: "saldo", label: "Saldosteuersatz" },
                            ].map((method) => (
                              <button
                                key={method.value}
                                type="button"
                                onClick={() => updateField("vatMethod", method.value)}
                                className={cn(
                                  "p-3 rounded-xl border-2 text-center transition-all",
                                  "hover:border-foreground/50",
                                  formData.vatMethod === method.value
                                    ? "border-foreground bg-muted"
                                    : "border-border"
                                )}
                              >
                                {method.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Abrechnungsperiode</Label>
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { value: "quarterly", label: "Quartal" },
                              { value: "semi_annual", label: "Halbjahr" },
                              { value: "annual", label: "Jahr" },
                            ].map((interval) => (
                              <button
                                key={interval.value}
                                type="button"
                                onClick={() => updateField("vatInterval", interval.value)}
                                className={cn(
                                  "p-3 rounded-xl border-2 text-center transition-all",
                                  "hover:border-foreground/50",
                                  formData.vatInterval === interval.value
                                    ? "border-foreground bg-muted"
                                    : "border-border"
                                )}
                              >
                                {interval.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {step.id === "fiscal-year" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Geschaeftsjahr beginnt im</Label>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                      {MONTHS.map((month, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => updateField("fiscalYearStart", i + 1)}
                          className={cn(
                            "p-3 rounded-xl border-2 text-center transition-all",
                            "hover:border-foreground/50",
                            formData.fiscalYearStart === i + 1
                              ? "border-foreground bg-muted"
                              : "border-border"
                          )}
                        >
                          {month}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step.id === "ai-settings" && (
                  <div className="space-y-3">
                    {AI_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => {
                          updateField("aiLevel", level.value);
                          updateField("aiConfidenceThreshold", level.threshold);
                        }}
                        className={cn(
                          "w-full p-5 rounded-xl border-2 text-left transition-all",
                          "hover:border-foreground/50",
                          formData.aiLevel === level.value
                            ? "border-foreground bg-muted"
                            : "border-border"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-lg">{level.label}</span>
                            <p className="text-sm text-muted-foreground mt-1">
                              {level.description}
                            </p>
                          </div>
                          {formData.aiLevel === level.value && (
                            <div className="w-6 h-6 rounded-full bg-foreground flex items-center justify-center">
                              <Check className="h-4 w-4 text-background" />
                            </div>
                          )}
                        </div>
                        {level.value === "balanced" && (
                          <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium bg-foreground/10 rounded-full">
                            Empfohlen
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {step.id === "summary" && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                      <SummaryRow
                        label="Firmenname"
                        value={formData.name}
                        onEdit={() => {
                          setDirection(-1);
                          setCurrentStep(1);
                        }}
                      />
                      <SummaryRow
                        label="Rechtsform"
                        value={
                          LEGAL_FORMS.find((f) => f.value === formData.legalForm)?.label ||
                          "-"
                        }
                        onEdit={() => {
                          setDirection(-1);
                          setCurrentStep(2);
                        }}
                      />
                      <SummaryRow
                        label="Branche"
                        value={
                          INDUSTRIES.find((i) => i.value === formData.industry)?.label ||
                          "-"
                        }
                        onEdit={() => {
                          setDirection(-1);
                          setCurrentStep(3);
                        }}
                      />
                      <SummaryRow
                        label="MwSt-pflichtig"
                        value={formData.vatLiable ? "Ja" : "Nein"}
                        onEdit={() => {
                          setDirection(-1);
                          setCurrentStep(5);
                        }}
                      />
                      <SummaryRow
                        label="Geschaeftsjahr"
                        value={`Beginnt im ${MONTHS[formData.fiscalYearStart - 1]}`}
                        onEdit={() => {
                          setDirection(-1);
                          setCurrentStep(6);
                        }}
                      />
                      <SummaryRow
                        label="KI-Autonomie"
                        value={
                          AI_LEVELS.find((l) => l.value === formData.aiLevel)?.label ||
                          "Ausgewogen"
                        }
                        onEdit={() => {
                          setDirection(-1);
                          setCurrentStep(7);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer with navigation */}
      <footer className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border">
        <div className="flex items-center justify-between px-4 py-4 md:px-6 max-w-xl mx-auto">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 0}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              currentStep === 0 && "invisible"
            )}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Zurueck
          </Button>

          {currentStep === STEPS.length - 1 ? (
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Wird erstellt...
                </>
              ) : (
                <>
                  Mandant erstellen
                  <Check className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={handleNext}
              disabled={!canProceed()}
              className="px-8"
            >
              {currentStep === 0 ? "Los geht's" : "Weiter"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-background">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={onEdit} className="text-muted-foreground">
        Bearbeiten
      </Button>
    </div>
  );
}
