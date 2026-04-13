"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Calculator,
  Upload,
  MessageCircle,
  Sparkles,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import {
  WizardHeader,
  WizardFooter,
  StepHeader,
  ChatSection,
  DocumentUploadSection,
  SuggestionsReview,
  FinalSummary,
  SelectionCard,
  VatSettings,
  FiscalYearSelector,
  TextInputCard,
  MONTHS,
} from "@/components/client-onboarding";

// Step definitions
const STEPS = [
  {
    id: "business-basics",
    title: "Firmendaten",
    subtitle: "Erzählen Sie uns von Ihrem Unternehmen",
    icon: Building2,
  },
  {
    id: "accounting-setup",
    title: "Buchhaltung einrichten",
    subtitle: "Konfigurieren Sie MwSt und Geschäftsjahr",
    icon: Calculator,
  },
  {
    id: "upload-documents",
    title: "Dokumente hochladen",
    subtitle: "Laden Sie erste Belege hoch, um die KI zu trainieren",
    icon: Upload,
  },
  {
    id: "business-questions",
    title: "Fragen zum Geschäft",
    subtitle: "Helfen Sie uns, Ihr Unternehmen besser zu verstehen",
    icon: MessageCircle,
  },
  {
    id: "intelligence-review",
    title: "KI-Vorschläge prüfen",
    subtitle: "Überprüfen und bestätigen Sie die Erkenntnisse",
    icon: Sparkles,
  },
  {
    id: "final-review",
    title: "Bereit zum Start",
    subtitle: "Überprüfen Sie alles und starten Sie durch",
    icon: Rocket,
  },
];

const LEGAL_FORMS = [
  { value: "einzelfirma", label: "Einzelfirma", description: "Einfachste Form" },
  { value: "gmbh", label: "GmbH", description: "Beliebte Rechtsform" },
  { value: "ag", label: "AG", description: "Aktiengesellschaft" },
  { value: "kollektiv", label: "Kollektivgesellschaft", description: "Partnerschaft" },
  { value: "verein", label: "Verein", description: "Non-Profit" },
  { value: "stiftung", label: "Stiftung", description: "Gemeinnützig" },
];

const INDUSTRIES = [
  { value: "gastro", label: "Gastgewerbe", icon: "🍽️" },
  { value: "handel", label: "Handel", icon: "🏪" },
  { value: "bau", label: "Baugewerbe", icon: "🏗️" },
  { value: "it", label: "IT & Tech", icon: "💻" },
  { value: "gesundheit", label: "Gesundheit", icon: "⚕️" },
  { value: "beratung", label: "Beratung", icon: "📊" },
  { value: "immobilien", label: "Immobilien", icon: "🏢" },
  { value: "andere", label: "Andere", icon: "📁" },
];

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  status: "uploading" | "uploaded" | "error";
}

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
}

interface AISuggestion {
  id: string;
  category: string;
  suggestion: string;
  confidence: number;
  confidenceLevel?: "high" | "needs_review" | "manual";
  source?: "chat" | "document" | "form" | "rule";
  reason?: string;
  status: "pending" | "accepted" | "rejected";
  field?: string;
  value?: string;
}

interface FormData {
  name: string;
  legalForm: string;
  industry: string;
  vatNumber: string;
  vatLiable: boolean;
  vatMethod: string;
  vatInterval: string;
  fiscalYearStart: number;
}

interface DraftData {
  id?: string;
  currentStep: number;
  formData: FormData;
  uploadedFiles: UploadedFile[];
  chatMessages: ChatMessage[];
  aiSuggestions: AISuggestion[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ClientOnboardingWizard() {
  const router = useRouter();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form data
  const [formData, setFormData] = useState<FormData>({
    name: "",
    legalForm: "",
    industry: "",
    vatNumber: "",
    vatLiable: true,
    vatMethod: "effektiv",
    vatInterval: "quarterly",
    fiscalYearStart: 1,
  });

  // Document upload state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // AI suggestions state
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const step = STEPS[currentStep];

  // Load existing draft
  const { data: existingDraft } = useSWR<{ draft: DraftData | null }>(
    "/api/client-onboarding?status=in_progress",
    fetcher,
    { revalidateOnFocus: false }
  );

  // Initialize from existing draft
  useEffect(() => {
    if (existingDraft?.draft) {
      const draft = existingDraft.draft;
      setDraftId(draft.id || null);
      setCurrentStep(draft.currentStep || 0);
      setFormData(draft.formData || formData);
      setUploadedFiles(draft.uploadedFiles || []);
      setChatMessages(draft.chatMessages || []);
      setAiSuggestions(draft.aiSuggestions || []);
    }
  }, [existingDraft]);

  // Initialize chat
  useEffect(() => {
    if (step.id === "business-questions" && chatMessages.length === 0) {
      loadInitialQuestion();
    }
  }, [step.id, chatMessages.length]);

  // Load AI suggestions
  useEffect(() => {
    if (step.id === "intelligence-review" && aiSuggestions.length === 0) {
      loadAISuggestions();
    }
  }, [step.id, aiSuggestions.length]);

  // Auto-save draft
  useEffect(() => {
    const timeout = setTimeout(() => saveDraft(), 1000);
    return () => clearTimeout(timeout);
  }, [formData, currentStep, uploadedFiles, chatMessages, aiSuggestions]);

  const saveDraft = async () => {
    if (!formData.name && currentStep === 0) return;

    setIsSaving(true);
    try {
      const payload: DraftData = {
        currentStep,
        formData,
        uploadedFiles: uploadedFiles.filter((f) => f.status === "uploaded"),
        chatMessages,
        aiSuggestions,
      };

      const res = await fetch("/api/client-onboarding", {
        method: draftId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftId ? { id: draftId, ...payload } : payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.id && !draftId) setDraftId(data.id);
      }
    } catch {
      // Silent fail for draft saves
    } finally {
      setIsSaving(false);
    }
  };

  const loadInitialQuestion = async () => {
    setIsTyping(true);
    setChatError(null);

    try {
      const res = await fetch("/api/client-onboarding/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          action: "start",
          context: {
            companyName: formData.name,
            legalForm: formData.legalForm,
            industry: formData.industry,
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to load question");

      const data = await res.json();
      setChatMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            data.question ||
            "Willkommen! Was ist die Haupttätigkeit Ihres Unternehmens?",
        },
      ]);
    } catch {
      setChatError("Verbindungsproblem. Fallback-Frage wird verwendet.");
      setChatMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Willkommen! Was ist die Haupttätigkeit Ihres Unternehmens?",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const loadAISuggestions = async () => {
    setIsLoadingSuggestions(true);
    setSuggestionsError(null);

    try {
      const res = await fetch("/api/client-onboarding/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          formData,
          chatMessages: chatMessages.filter((m) => m.role === "user").map((m) => m.content),
          uploadedFiles: uploadedFiles.filter((f) => f.status === "uploaded").map((f) => f.id),
        }),
      });

      if (!res.ok) throw new Error("Failed to load suggestions");

      const data = await res.json();
      setAiSuggestions(data.suggestions || []);
    } catch {
      setSuggestionsError("Vorschläge konnten nicht geladen werden");
      setAiSuggestions([
        {
          id: "1",
          category: "Kontenrahmen",
          suggestion: "KMU-Kontenrahmen empfohlen basierend auf Ihrer Branche",
          confidence: 0.85,
          status: "pending",
          field: "chartOfAccounts",
          value: "kmu",
        },
        {
          id: "2",
          category: "Kostenstellen",
          suggestion: "Einfache Kostenstellenstruktur ohne Untergliederung",
          confidence: 0.8,
          status: "pending",
          field: "costCenters",
          value: "simple",
        },
      ]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const updateField = useCallback(
    (field: keyof FormData, value: string | boolean | number) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const canProceed = useCallback(() => {
    switch (step.id) {
      case "business-basics":
        return formData.name.trim().length >= 2 && formData.legalForm && formData.industry;
      case "business-questions":
        return chatMessages.length >= 3;
      case "intelligence-review":
        return !isLoadingSuggestions && aiSuggestions.every((s) => s.status !== "pending");
      default:
        return true;
    }
  }, [step.id, formData, chatMessages.length, isLoadingSuggestions, aiSuggestions]);

  const getValidationMessage = useCallback(() => {
    switch (step.id) {
      case "business-basics":
        if (!formData.name.trim()) return "Bitte geben Sie den Firmennamen ein";
        if (formData.name.trim().length < 2) return "Firmenname zu kurz";
        if (!formData.legalForm) return "Bitte wählen Sie eine Rechtsform";
        if (!formData.industry) return "Bitte wählen Sie eine Branche";
        return null;
      case "business-questions":
        if (chatMessages.length < 3) return "Bitte beantworten Sie mindestens eine Frage";
        return null;
      case "intelligence-review":
        const pending = aiSuggestions.filter((s) => s.status === "pending").length;
        if (pending > 0) return `Noch ${pending} Vorschläge offen`;
        return null;
      default:
        return null;
    }
  }, [step.id, formData, chatMessages.length, aiSuggestions]);

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

  // File upload handlers
  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    const newFiles: UploadedFile[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
      status: "uploading" as const,
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileEntry = newFiles[i];

      try {
        const formDataUpload = new FormData();
        formDataUpload.append("file", file);
        formDataUpload.append("source", "onboarding");
        if (draftId) formDataUpload.append("draftId", draftId);

        const res = await fetch("/api/client-onboarding/upload", {
          method: "POST",
          body: formDataUpload,
        });

        if (!res.ok) throw new Error("Upload failed");

        const data = await res.json();

        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === fileEntry.id
              ? { ...f, status: "uploaded" as const, url: data.url, id: data.id || f.id }
              : f
          )
        );
      } catch {
        setUploadedFiles((prev) =>
          prev.map((f) => (f.id === fileEntry.id ? { ...f, status: "error" as const } : f))
        );
        toast.error(`Fehler beim Hochladen von ${file.name}`);
      }
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const retryUpload = () => {
    toast.info("Bitte wählen Sie die Datei erneut aus");
  };

  // Chat handlers
  const sendMessage = async () => {
    if (!chatInput.trim() || isTyping) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: chatInput,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setIsTyping(true);
    setChatError(null);

    try {
      const res = await fetch("/api/client-onboarding/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          action: "respond",
          userMessage: chatInput,
          context: {
            companyName: formData.name,
            legalForm: formData.legalForm,
            industry: formData.industry,
          },
          previousMessages: chatMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error("Failed to get response");

      const data = await res.json();

      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.question || data.response || "Danke für die Information!",
        },
      ]);
    } catch {
      setChatError("Verbindungsproblem");
      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Danke für die Information! Haben Sie noch weitere Details?",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Suggestion handlers
  const updateSuggestion = async (id: string, status: "accepted" | "rejected") => {
    setAiSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));

    try {
      await fetch("/api/client-onboarding/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, suggestionId: id, status }),
      });
    } catch {
      // Non-blocking
    }
  };

  const resetSuggestions = () => {
    setAiSuggestions((prev) => prev.map((s) => ({ ...s, status: "pending" as const })));
  };

  // Submit handler
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const acceptedSuggestions = aiSuggestions
        .filter((s) => s.status === "accepted")
        .reduce(
          (acc, s) => {
            if (s.field && s.value) acc[s.field] = s.value;
            return acc;
          },
          {} as Record<string, string>
        );

      const uploadedFilePaths = uploadedFiles
        .filter((f) => f.status === "uploaded" && f.url)
        .map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          size: f.size,
          url: f.url,
        }));

      const payload = {
        name: formData.name,
        legalName: formData.name,
        legalForm: formData.legalForm,
        industry: formData.industry,
        vatNumber: formData.vatNumber,
        vatLiable: formData.vatLiable,
        vatMethod: formData.vatMethod,
        vatInterval: formData.vatInterval,
        fiscalYearStart: formData.fiscalYearStart,
        aiConfidenceThreshold: 0.65,
        currency: "CHF",
        onboardingDraftId: draftId,
        onboardingFiles: uploadedFilePaths,
        ...acceptedSuggestions,
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

      const newClient = await res.json();

      if (draftId) {
        await fetch("/api/client-onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: draftId,
            status: "completed",
            companyId: newClient.id,
          }),
        });
      }

      toast.success("Mandant erfolgreich erstellt!");
      router.push(`/trustee/clients`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ein Fehler ist aufgetreten";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExit = async () => {
    await saveDraft();
    if (formData.name) {
      toast.success("Entwurf gespeichert");
    }
    router.push("/trustee/clients");
  };

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d < 0 ? 60 : -60, opacity: 0 }),
  };

  // Build summary items
  const summaryItems = [
    { label: "Firmenname", value: formData.name, onEdit: () => goToStep(0) },
    {
      label: "Rechtsform",
      value: LEGAL_FORMS.find((f) => f.value === formData.legalForm)?.label || "-",
      onEdit: () => goToStep(0),
    },
    {
      label: "Branche",
      value: INDUSTRIES.find((i) => i.value === formData.industry)?.label || "-",
      onEdit: () => goToStep(0),
    },
    {
      label: "MwSt-pflichtig",
      value: formData.vatLiable ? "Ja" : "Nein",
      onEdit: () => goToStep(1),
    },
    {
      label: "Geschäftsjahr",
      value: `Beginnt im ${MONTHS[formData.fiscalYearStart - 1]}`,
      onEdit: () => goToStep(1),
    },
    {
      label: "Dokumente",
      value: `${uploadedFiles.filter((f) => f.status === "uploaded").length} hochgeladen`,
      onEdit: () => goToStep(2),
    },
    {
      label: "KI-Vorschläge",
      value: `${aiSuggestions.filter((s) => s.status === "accepted").length} akzeptiert`,
      onEdit: () => goToStep(4),
    },
  ];

  const goToStep = (index: number) => {
    setDirection(-1);
    setCurrentStep(index);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <WizardHeader
        steps={STEPS}
        currentStep={currentStep}
        isSaving={isSaving}
        onBack={handleBack}
        onExit={handleExit}
      />

      <main className="flex-1 flex flex-col">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="flex-1 flex flex-col"
          >
            <StepHeader icon={step.icon} title={step.title} subtitle={step.subtitle} />

            <div className="flex-1 px-4 pb-8 md:pb-12">
              <div className="max-w-xl mx-auto">
                {/* Step 1: Business Basics */}
                {step.id === "business-basics" && (
                  <div className="space-y-8">
                    <TextInputCard
                      id="name"
                      label="Firmenname"
                      value={formData.name}
                      placeholder="z.B. Muster GmbH"
                      onChange={(v) => updateField("name", v)}
                      autoFocus
                    />

                    <div>
                      <Label className="text-sm font-medium text-slate-700 mb-3 block">
                        Rechtsform
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {LEGAL_FORMS.map((form) => (
                          <SelectionCard
                            key={form.value}
                            value={form.value}
                            selected={formData.legalForm === form.value}
                            onSelect={() => updateField("legalForm", form.value)}
                            label={form.label}
                            description={form.description}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-slate-700 mb-3 block">
                        Branche
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {INDUSTRIES.map((ind) => (
                          <SelectionCard
                            key={ind.value}
                            value={ind.value}
                            selected={formData.industry === ind.value}
                            onSelect={() => updateField("industry", ind.value)}
                            label={ind.label}
                            icon={ind.icon}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Accounting Setup */}
                {step.id === "accounting-setup" && (
                  <div className="space-y-6">
                    <TextInputCard
                      id="vatNumber"
                      label="UID / MwSt-Nummer"
                      value={formData.vatNumber}
                      placeholder="CHE-xxx.xxx.xxx"
                      onChange={(v) => updateField("vatNumber", v)}
                    />

                    <VatSettings
                      vatLiable={formData.vatLiable}
                      vatMethod={formData.vatMethod}
                      vatInterval={formData.vatInterval}
                      onVatLiableChange={(v) => updateField("vatLiable", v)}
                      onVatMethodChange={(v) => updateField("vatMethod", v)}
                      onVatIntervalChange={(v) => updateField("vatInterval", v)}
                    />

                    <FiscalYearSelector
                      value={formData.fiscalYearStart}
                      onChange={(v) => updateField("fiscalYearStart", v)}
                    />
                  </div>
                )}

                {/* Step 3: Upload Documents */}
                {step.id === "upload-documents" && (
                  <DocumentUploadSection
                    files={uploadedFiles}
                    onFilesSelect={handleFileSelect}
                    onRemoveFile={removeFile}
                    onRetryUpload={retryUpload}
                  />
                )}

                {/* Step 4: Business Questions */}
                {step.id === "business-questions" && (
                  <ChatSection
                    messages={chatMessages}
                    input={chatInput}
                    isTyping={isTyping}
                    error={chatError}
                    onInputChange={setChatInput}
                    onSend={sendMessage}
                  />
                )}

                {/* Step 5: Intelligence Review */}
                {step.id === "intelligence-review" && (
                  <SuggestionsReview
                    suggestions={aiSuggestions}
                    isLoading={isLoadingSuggestions}
                    error={suggestionsError}
                    onUpdate={updateSuggestion}
                    onReset={resetSuggestions}
                    onRetry={loadAISuggestions}
                  />
                )}

                {/* Step 6: Final Review */}
                {step.id === "final-review" && (
                  <FinalSummary
                    items={summaryItems}
                    acceptedSuggestions={aiSuggestions.filter((s) => s.status === "accepted")}
                  />
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      <WizardFooter
        isLastStep={currentStep === STEPS.length - 1}
        canProceed={canProceed()}
        isSubmitting={isSubmitting}
        validationMessage={getValidationMessage()}
        onNext={handleNext}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
