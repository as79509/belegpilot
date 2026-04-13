"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
  Calculator,
  Upload,
  MessageCircle,
  Sparkles,
  Rocket,
  Check,
  Loader2,
  Send,
  FileText,
  Image as ImageIcon,
  File,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import useSWR, { mutate } from "swr";

// Step definitions matching the config
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

const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
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

// SWR fetcher
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
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat state for business questions
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // AI suggestions state
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const progress = ((currentStep) / (STEPS.length - 1)) * 100;
  const step = STEPS[currentStep];

  // Load existing draft on mount
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

  // Initialize chat on business-questions step
  useEffect(() => {
    if (step.id === "business-questions" && chatMessages.length === 0) {
      loadInitialQuestion();
    }
  }, [step.id, chatMessages.length]);

  // Load AI suggestions when entering intelligence-review step
  useEffect(() => {
    if (step.id === "intelligence-review" && aiSuggestions.length === 0) {
      loadAISuggestions();
    }
  }, [step.id, aiSuggestions.length]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Auto-save draft when data changes (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      saveDraft();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [formData, currentStep, uploadedFiles, chatMessages, aiSuggestions]);

  const saveDraft = async () => {
    if (!formData.name && currentStep === 0) return; // Don't save empty drafts
    
    setIsSaving(true);
    try {
      const payload: DraftData = {
        currentStep,
        formData,
        uploadedFiles: uploadedFiles.filter(f => f.status === "uploaded"),
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
        if (data.id && !draftId) {
          setDraftId(data.id);
        }
      }
    } catch (err) {
      // Silently fail draft saves - non-blocking
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
      setChatMessages([{
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.question || "Willkommen! Was ist die Haupttätigkeit Ihres Unternehmens?",
      }]);
    } catch (err) {
      // Fallback to default question
      setChatError("Fehler beim Laden der Fragen. Bitte versuchen Sie es erneut.");
      // Fallback question
      setChatMessages([{
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Willkommen! Was ist die Haupttätigkeit Ihres Unternehmens?",
      }]);
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
          chatMessages: chatMessages.filter(m => m.role === "user").map(m => m.content),
          uploadedFiles: uploadedFiles.filter(f => f.status === "uploaded").map(f => f.id),
        }),
      });

      if (!res.ok) throw new Error("Failed to load suggestions");

      const data = await res.json();
      setAiSuggestions(data.suggestions || []);
    } catch (err) {
      // Use fallback suggestions
      setSuggestionsError("Fehler beim Laden der KI-Vorschläge");
      // Provide default suggestions as fallback
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
          confidence: 0.80,
          status: "pending",
          field: "costCenters",
          value: "simple",
        },
        {
          id: "3",
          category: "Belegkategorien",
          suggestion: "Standard-Belegkategorien mit branchenspezifischen Ergänzungen",
          confidence: 0.82,
          status: "pending",
          field: "documentCategories",
          value: "standard_plus",
        },
      ]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const updateField = useCallback((field: keyof FormData, value: string | boolean | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const canProceed = useCallback(() => {
    switch (step.id) {
      case "business-basics":
        return formData.name.trim().length >= 2 && formData.legalForm && formData.industry;
      case "accounting-setup":
        return true;
      case "upload-documents":
        return true;
      case "business-questions":
        return chatMessages.length >= 3;
      case "intelligence-review":
        return !isLoadingSuggestions && aiSuggestions.every((s) => s.status !== "pending");
      case "final-review":
        return true;
      default:
        return true;
    }
  }, [step.id, formData, chatMessages.length, isLoadingSuggestions, aiSuggestions]);

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

  // File upload handlers with real upload
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

    // Upload each file
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
      } catch (err) {
        // Toast already shows error
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === fileEntry.id ? { ...f, status: "error" as const } : f
          )
        );
        toast.error(`Fehler beim Hochladen von ${file.name}`);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const retryUpload = (file: UploadedFile) => {
    // Remove and re-add to trigger upload
    setUploadedFiles((prev) => prev.filter((f) => f.id !== file.id));
    // Note: Would need original File object to retry, simplified for now
    toast.info("Bitte wählen Sie die Datei erneut aus");
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return ImageIcon;
    if (type === "application/pdf") return FileText;
    return File;
  };

  // Chat handlers with real API
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
          previousMessages: chatMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error("Failed to get response");

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.question || data.response || "Danke für die Information!",
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      // Fallback response provided
      setChatError("Fehler bei der Kommunikation. Bitte versuchen Sie es erneut.");
      // Fallback response
      const fallbackMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Danke für die Information! Haben Sie noch weitere Details zu Ihrem Geschäftsmodell?",
      };
      setChatMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // AI suggestion handlers
  const updateSuggestion = async (id: string, status: "accepted" | "rejected") => {
    setAiSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );

    // Persist decision to backend
    try {
      await fetch("/api/client-onboarding/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          suggestionId: id,
          status,
        }),
      });
    } catch (err) {
      // Non-blocking - local state already updated
    }
  };

  const resetSuggestions = () => {
    setAiSuggestions((prev) => prev.map((s) => ({ ...s, status: "pending" as const })));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Prepare accepted suggestions as config
      const acceptedSuggestions = aiSuggestions
        .filter((s) => s.status === "accepted")
        .reduce((acc, s) => {
          if (s.field && s.value) {
            acc[s.field] = s.value;
          }
          return acc;
        }, {} as Record<string, string>);

      // Include uploaded files for migration to the new company
      const uploadedFilePaths = uploadedFiles
        .filter(f => f.status === "uploaded" && f.url)
        .map(f => ({
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

      // Mark draft as completed
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
      
      // Redirect to the new client's dashboard or back to clients list
      router.push(`/trustee/clients`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ein Fehler ist aufgetreten";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExit = async () => {
    // Save draft before exiting
    await saveDraft();
    
    if (formData.name) {
      toast.success("Entwurf gespeichert. Sie können später fortfahren.");
    }
    router.push("/trustee/clients");
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 60 : -60,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 60 : -60,
      opacity: 0,
    }),
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200/80">
        <div className="max-w-5xl mx-auto">
          {/* Top bar with logo and exit */}
          <div className="flex items-center justify-between px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className="p-2 -ml-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-slate-600" />
                </button>
              )}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">B</span>
                </div>
                <span className="font-semibold text-slate-900 hidden sm:block">BelegPilot</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isSaving && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Speichern...
                </span>
              )}
              <button
                onClick={handleExit}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span className="hidden sm:inline">Speichern & Beenden</span>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-4 pb-3 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-slate-900 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
              <span className="text-xs font-medium text-slate-500 tabular-nums">
                {currentStep + 1}/{STEPS.length}
              </span>
            </div>
          </div>

          {/* Step indicators */}
          <div className="px-4 pb-4 md:px-6">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
              {STEPS.map((s, i) => (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                    i === currentStep
                      ? "bg-slate-900 text-white"
                      : i < currentStep
                      ? "bg-slate-100 text-slate-600"
                      : "text-slate-400"
                  )}
                >
                  {i < currentStep ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span className="w-4 text-center">{i + 1}</span>
                  )}
                  <span className="hidden md:inline">{s.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
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
            {/* Step header */}
            <div className="px-4 pt-8 pb-6 md:pt-12 md:pb-8 text-center max-w-2xl mx-auto w-full">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-200/80 mb-4"
              >
                <step.icon className="h-6 w-6 text-slate-700" />
              </motion.div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 text-balance">
                {step.title}
              </h1>
              <p className="text-slate-500 text-base mt-2 max-w-md mx-auto">
                {step.subtitle}
              </p>
            </div>

            {/* Step content */}
            <div className="flex-1 px-4 pb-8 md:pb-12">
              <div className="max-w-xl mx-auto">
                {/* Step 1: Business Basics */}
                {step.id === "business-basics" && (
                  <div className="space-y-8">
                    {/* Company name input */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
                      <Label htmlFor="name" className="text-sm font-medium text-slate-700 mb-2 block">
                        Firmenname
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        placeholder="z.B. Muster GmbH"
                        className="h-12 text-base rounded-xl border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                        autoFocus
                      />
                    </div>

                    {/* Legal form selection */}
                    <div>
                      <Label className="text-sm font-medium text-slate-700 mb-3 block">
                        Rechtsform
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {LEGAL_FORMS.map((form) => (
                          <button
                            key={form.value}
                            type="button"
                            onClick={() => updateField("legalForm", form.value)}
                            className={cn(
                              "relative p-4 rounded-xl text-left transition-all",
                              "bg-white border shadow-sm hover:shadow-md",
                              formData.legalForm === form.value
                                ? "border-slate-900 ring-1 ring-slate-900"
                                : "border-slate-200/80 hover:border-slate-300"
                            )}
                          >
                            {formData.legalForm === form.value && (
                              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                            <span className="font-medium text-slate-900 block">{form.label}</span>
                            <span className="text-xs text-slate-500 mt-0.5 block">{form.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Industry selection */}
                    <div>
                      <Label className="text-sm font-medium text-slate-700 mb-3 block">
                        Branche
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {INDUSTRIES.map((ind) => (
                          <button
                            key={ind.value}
                            type="button"
                            onClick={() => updateField("industry", ind.value)}
                            className={cn(
                              "relative p-4 rounded-xl text-left transition-all",
                              "bg-white border shadow-sm hover:shadow-md",
                              formData.industry === ind.value
                                ? "border-slate-900 ring-1 ring-slate-900"
                                : "border-slate-200/80 hover:border-slate-300"
                            )}
                          >
                            {formData.industry === ind.value && (
                              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                            <span className="text-lg mb-1 block">{ind.icon}</span>
                            <span className="font-medium text-slate-900 text-sm">{ind.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Accounting Setup */}
                {step.id === "accounting-setup" && (
                  <div className="space-y-6">
                    {/* VAT number */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
                      <Label htmlFor="vatNumber" className="text-sm font-medium text-slate-700 mb-2 block">
                        UID / MwSt-Nummer
                      </Label>
                      <Input
                        id="vatNumber"
                        value={formData.vatNumber}
                        onChange={(e) => updateField("vatNumber", e.target.value)}
                        placeholder="CHE-xxx.xxx.xxx"
                        className="h-12 text-base rounded-xl border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                      />
                    </div>

                    {/* VAT liable toggle */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                      <label className="flex items-center gap-4 p-5 cursor-pointer hover:bg-slate-50 transition-colors">
                        <Checkbox
                          checked={formData.vatLiable}
                          onCheckedChange={(c) => updateField("vatLiable", !!c)}
                          className="h-5 w-5 rounded border-slate-300"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-slate-900 block">Mehrwertsteuerpflichtig</span>
                          <p className="text-sm text-slate-500 mt-0.5">
                            Das Unternehmen ist bei der ESTV registriert
                          </p>
                        </div>
                      </label>

                      {formData.vatLiable && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="border-t border-slate-100 p-5 space-y-5 bg-slate-50/50"
                        >
                          <div>
                            <Label className="text-sm font-medium text-slate-700 mb-2 block">
                              Abrechnungsmethode
                            </Label>
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                { value: "effektiv", label: "Effektiv", desc: "Voller Vorsteuerabzug" },
                                { value: "saldo", label: "Saldosteuersatz", desc: "Vereinfacht" },
                              ].map((method) => (
                                <button
                                  key={method.value}
                                  type="button"
                                  onClick={() => updateField("vatMethod", method.value)}
                                  className={cn(
                                    "p-3 rounded-xl text-left transition-all bg-white border",
                                    formData.vatMethod === method.value
                                      ? "border-slate-900 ring-1 ring-slate-900"
                                      : "border-slate-200 hover:border-slate-300"
                                  )}
                                >
                                  <span className="font-medium text-slate-900 text-sm block">{method.label}</span>
                                  <span className="text-xs text-slate-500">{method.desc}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm font-medium text-slate-700 mb-2 block">
                              Abrechnungsperiode
                            </Label>
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
                                    "p-3 rounded-xl text-center text-sm font-medium transition-all bg-white border",
                                    formData.vatInterval === interval.value
                                      ? "border-slate-900 ring-1 ring-slate-900 text-slate-900"
                                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                                  )}
                                >
                                  {interval.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Fiscal year */}
                    <div>
                      <Label className="text-sm font-medium text-slate-700 mb-3 block">
                        Geschäftsjahr beginnt im
                      </Label>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                        {MONTHS.map((month, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => updateField("fiscalYearStart", i + 1)}
                            className={cn(
                              "p-3 rounded-xl text-center text-sm font-medium transition-all",
                              "bg-white border shadow-sm",
                              formData.fiscalYearStart === i + 1
                                ? "border-slate-900 ring-1 ring-slate-900 text-slate-900"
                                : "border-slate-200/80 hover:border-slate-300 text-slate-600"
                            )}
                          >
                            {month}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Upload Documents */}
                {step.id === "upload-documents" && (
                  <div className="space-y-6">
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "bg-white border-2 border-dashed rounded-2xl p-10 md:p-14 text-center cursor-pointer transition-all shadow-sm",
                        isDragging
                          ? "border-slate-400 bg-slate-50"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files)}
                      />
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <Upload className="h-7 w-7 text-slate-500" />
                      </div>
                      <p className="font-medium text-slate-900 text-lg">
                        Belege hierher ziehen
                      </p>
                      <p className="text-slate-500 mt-1">
                        oder klicken zum Auswählen
                      </p>
                      <p className="text-xs text-slate-400 mt-4">
                        PDF, JPG, PNG - max. 10MB pro Datei
                      </p>
                    </div>

                    {uploadedFiles.length > 0 && (
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                          <p className="text-sm font-medium text-slate-700">
                            {uploadedFiles.length} Datei{uploadedFiles.length > 1 ? "en" : ""}
                          </p>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {uploadedFiles.map((file) => {
                            const FileIcon = getFileIcon(file.type);
                            return (
                              <div
                                key={file.id}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                              >
                                <div className={cn(
                                  "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                                  file.status === "error" ? "bg-red-100" : "bg-slate-100"
                                )}>
                                  {file.status === "uploading" ? (
                                    <Loader2 className="h-4 w-4 text-slate-500 animate-spin" />
                                  ) : file.status === "error" ? (
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                  ) : (
                                    <FileIcon className="h-4 w-4 text-slate-500" />
                                  )}
                                </div>
                                <span className={cn(
                                  "flex-1 truncate text-sm",
                                  file.status === "error" ? "text-red-600" : "text-slate-700"
                                )}>
                                  {file.name}
                                </span>
                                {file.status === "uploaded" && (
                                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                                )}
                                {file.status === "error" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      retryUpload(file);
                                    }}
                                    className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
                                  >
                                    Erneut
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeFile(file.id);
                                  }}
                                  className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                  <Trash2 className="h-4 w-4 text-slate-400" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <p className="text-sm text-slate-500 text-center">
                      Sie können diesen Schritt überspringen und später Belege hochladen
                    </p>
                  </div>
                )}

                {/* Step 4: Business Questions (Chat) */}
                {step.id === "business-questions" && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div className="flex flex-col h-[420px] md:h-[480px]">
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {chatMessages.map((message) => (
                          <div
                            key={message.id}
                            className={cn(
                              "flex",
                              message.role === "user" ? "justify-end" : "justify-start"
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[85%] px-4 py-3 rounded-2xl",
                                message.role === "user"
                                  ? "bg-slate-900 text-white rounded-br-md"
                                  : "bg-slate-100 text-slate-700 rounded-bl-md"
                              )}
                            >
                              <p className="text-sm leading-relaxed">{message.content}</p>
                            </div>
                          </div>
                        ))}
                        {isTyping && (
                          <div className="flex justify-start">
                            <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-md">
                              <div className="flex gap-1">
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                            </div>
                          </div>
                        )}
                        {chatError && (
                          <div className="flex justify-center">
                            <div className="bg-red-50 text-red-600 text-xs px-3 py-1.5 rounded-full">
                              {chatError}
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>

                      <div className="border-t border-slate-100 p-4 bg-slate-50">
                        <div className="flex gap-2">
                          <Input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                            placeholder="Ihre Antwort..."
                            className="h-11 rounded-xl border-slate-200 bg-white focus:border-slate-400 focus:ring-slate-400"
                            disabled={isTyping}
                          />
                          <Button
                            onClick={sendMessage}
                            disabled={!chatInput.trim() || isTyping}
                            size="lg"
                            className="h-11 px-4 rounded-xl bg-slate-900 hover:bg-slate-800"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5: Intelligence Review */}
                {step.id === "intelligence-review" && (
                  <div className="space-y-4">
                    {isLoadingSuggestions ? (
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                          <Loader2 className="h-7 w-7 text-slate-500 animate-spin" />
                        </div>
                        <p className="text-lg font-medium text-slate-900">Analysiere Ihre Daten...</p>
                        <p className="text-slate-500 mt-1">
                          Die KI erstellt Vorschläge basierend auf Ihren Angaben
                        </p>
                      </div>
                    ) : suggestionsError ? (
                      <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8 text-center">
                        <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                        <p className="text-slate-900 font-medium">{suggestionsError}</p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={loadAISuggestions}
                        >
                          Erneut versuchen
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between px-1">
                          <p className="text-sm text-slate-500">
                            {aiSuggestions.filter((s) => s.status !== "pending").length} von {aiSuggestions.length} bewertet
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetSuggestions}
                            className="text-slate-500 hover:text-slate-700"
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Zurücksetzen
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {aiSuggestions.map((suggestion) => (
                            <div
                              key={suggestion.id}
                              className={cn(
                                "bg-white p-5 rounded-2xl shadow-sm border transition-all",
                                suggestion.status === "accepted" && "border-emerald-300 bg-emerald-50/50",
                                suggestion.status === "rejected" && "border-red-300 bg-red-50/50",
                                suggestion.status === "pending" && "border-slate-200/80"
                              )}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                                      {suggestion.category}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                      {Math.round(suggestion.confidence * 100)}% Konfidenz
                                    </span>
                                  </div>
                                  <p className="font-medium text-slate-900">{suggestion.suggestion}</p>
                                </div>

                                {suggestion.status === "pending" ? (
                                  <div className="flex gap-2 shrink-0">
                                    <button
                                      onClick={() => updateSuggestion(suggestion.id, "rejected")}
                                      className="h-10 w-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-colors"
                                    >
                                      <ThumbsDown className="h-4 w-4 text-slate-500" />
                                    </button>
                                    <button
                                      onClick={() => updateSuggestion(suggestion.id, "accepted")}
                                      className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors"
                                    >
                                      <ThumbsUp className="h-4 w-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className={cn(
                                    "flex items-center justify-center h-10 w-10 rounded-xl shrink-0",
                                    suggestion.status === "accepted" ? "bg-emerald-500" : "bg-red-500"
                                  )}>
                                    {suggestion.status === "accepted" ? (
                                      <ThumbsUp className="h-4 w-4 text-white" />
                                    ) : (
                                      <ThumbsDown className="h-4 w-4 text-white" />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Step 6: Final Review */}
                {step.id === "final-review" && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                      <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                        <p className="font-semibold text-slate-900">Zusammenfassung</p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        <SummaryRow
                          label="Firmenname"
                          value={formData.name}
                          onEdit={() => {
                            setDirection(-1);
                            setCurrentStep(0);
                          }}
                        />
                        <SummaryRow
                          label="Rechtsform"
                          value={LEGAL_FORMS.find((f) => f.value === formData.legalForm)?.label || "-"}
                          onEdit={() => {
                            setDirection(-1);
                            setCurrentStep(0);
                          }}
                        />
                        <SummaryRow
                          label="Branche"
                          value={INDUSTRIES.find((i) => i.value === formData.industry)?.label || "-"}
                          onEdit={() => {
                            setDirection(-1);
                            setCurrentStep(0);
                          }}
                        />
                        <SummaryRow
                          label="MwSt-pflichtig"
                          value={formData.vatLiable ? "Ja" : "Nein"}
                          onEdit={() => {
                            setDirection(-1);
                            setCurrentStep(1);
                          }}
                        />
                        <SummaryRow
                          label="Geschäftsjahr"
                          value={`Beginnt im ${MONTHS[formData.fiscalYearStart - 1]}`}
                          onEdit={() => {
                            setDirection(-1);
                            setCurrentStep(1);
                          }}
                        />
                        <SummaryRow
                          label="Dokumente"
                          value={`${uploadedFiles.filter(f => f.status === "uploaded").length} hochgeladen`}
                          onEdit={() => {
                            setDirection(-1);
                            setCurrentStep(2);
                          }}
                        />
                        <SummaryRow
                          label="KI-Vorschläge"
                          value={`${aiSuggestions.filter((s) => s.status === "accepted").length} akzeptiert`}
                          onEdit={() => {
                            setDirection(-1);
                            setCurrentStep(4);
                          }}
                        />
                      </div>
                    </div>

                    {/* Ready banner */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold">Bereit zum Start</p>
                          <p className="text-sm text-slate-300 mt-1">
                            Nach der Erstellung können Sie sofort Belege hochladen und die KI wird automatisch mit der Kategorisierung beginnen.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer with navigation */}
      <footer className="sticky bottom-0 bg-white border-t border-slate-200/80">
        <div className="flex items-center justify-end px-4 py-4 md:px-6 max-w-xl mx-auto">
          {currentStep === STEPS.length - 1 ? (
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 h-12 rounded-xl text-base bg-slate-900 hover:bg-slate-800"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Wird erstellt...
                </>
              ) : (
                <>
                  Mandant erstellen
                  <Rocket className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={handleNext}
              disabled={!canProceed()}
              className="px-8 h-12 rounded-xl text-base bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300"
            >
              Weiter
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
    <div className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="font-medium text-slate-900">{value}</p>
      </div>
      <button
        onClick={onEdit}
        className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 hover:bg-slate-100 rounded-lg transition-colors"
      >
        Bearbeiten
      </button>
    </div>
  );
}
