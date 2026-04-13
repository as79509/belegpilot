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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  { value: "einzelfirma", label: "Einzelfirma" },
  { value: "gmbh", label: "GmbH" },
  { value: "ag", label: "AG" },
  { value: "kollektiv", label: "Kollektivgesellschaft" },
  { value: "verein", label: "Verein" },
  { value: "stiftung", label: "Stiftung" },
];

const INDUSTRIES = [
  { value: "gastro", label: "Gastgewerbe" },
  { value: "handel", label: "Handel" },
  { value: "bau", label: "Baugewerbe" },
  { value: "it", label: "IT & Tech" },
  { value: "gesundheit", label: "Gesundheit" },
  { value: "beratung", label: "Beratung" },
  { value: "immobilien", label: "Immobilien" },
  { value: "andere", label: "Andere" },
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

export default function ClientOnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content: "Willkommen! Ich habe ein paar Fragen, um Ihr Unternehmen besser zu verstehen. Was ist die Haupttätigkeit Ihres Unternehmens?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // AI suggestions state
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([
    {
      id: "1",
      category: "Kontenrahmen",
      suggestion: "KMU-Kontenrahmen empfohlen basierend auf Ihrer Branche",
      confidence: 0.92,
      status: "pending",
    },
    {
      id: "2",
      category: "Kostenstellen",
      suggestion: "Einfache Kostenstellenstruktur ohne Untergliederung",
      confidence: 0.85,
      status: "pending",
    },
    {
      id: "3",
      category: "Belegkategorien",
      suggestion: "Standard-Belegkategorien mit branchenspezifischen Ergänzungen",
      confidence: 0.88,
      status: "pending",
    },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(true);

  const progress = ((currentStep) / (STEPS.length - 1)) * 100;
  const step = STEPS[currentStep];

  // Simulate AI analysis on intelligence review step
  useEffect(() => {
    if (step.id === "intelligence-review" && isAnalyzing) {
      const timer = setTimeout(() => {
        setIsAnalyzing(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step.id, isAnalyzing]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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
        return true; // Optional step
      case "business-questions":
        return chatMessages.length >= 3; // At least one Q&A exchange
      case "intelligence-review":
        return !isAnalyzing && aiSuggestions.every((s) => s.status !== "pending");
      case "final-review":
        return true;
      default:
        return true;
    }
  }, [step.id, formData, chatMessages.length, isAnalyzing, aiSuggestions]);

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
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const newFiles: UploadedFile[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: file.type,
      size: file.size,
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
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

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return ImageIcon;
    if (type === "application/pdf") return FileText;
    return File;
  };

  // Chat handlers
  const sendMessage = () => {
    if (!chatInput.trim()) return;
    
    const userMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      role: "user",
      content: chatInput,
    };
    
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "Verstanden! Wie viele Mitarbeiter hat Ihr Unternehmen ungefähr?",
        "Interessant! Arbeiten Sie hauptsächlich mit Geschäftskunden (B2B) oder Privatkunden (B2C)?",
        "Danke für die Info! Das hilft mir sehr bei der Konfiguration. Haben Sie regelmässige wiederkehrende Einnahmen wie Abonnements?",
        "Perfekt! Ich habe genug Informationen gesammelt. Sie können jetzt zum nächsten Schritt gehen.",
      ];
      
      const nextResponse = responses[Math.min(chatMessages.length - 1, responses.length - 1)];
      
      const assistantMessage: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        role: "assistant",
        content: nextResponse,
      };
      
      setChatMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500);
  };

  // AI suggestion handlers
  const updateSuggestion = (id: string, status: "accepted" | "rejected") => {
    setAiSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );
  };

  const resetSuggestions = () => {
    setAiSuggestions((prev) => prev.map((s) => ({ ...s, status: "pending" })));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ein Fehler ist aufgetreten";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExit = () => {
    if (formData.name) {
      toast.info("Entwurf wurde nicht gespeichert");
    }
    router.push("/trustee/clients");
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 80 : -80,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 80 : -80,
      opacity: 0,
    }),
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header with progress */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              currentStep === 0 && "invisible"
            )}
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="ml-1 hidden sm:inline">Zurück</span>
          </Button>

          <div className="flex-1 max-w-md mx-4">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-foreground rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleExit}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
            <span className="ml-1 hidden sm:inline">Speichern & Beenden</span>
          </Button>
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
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex-1 flex flex-col"
          >
            {/* Step header */}
            <div className="px-4 py-8 md:py-12 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted mb-4"
              >
                <step.icon className="h-7 w-7 text-foreground" />
              </motion.div>
              <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-balance">
                {step.title}
              </h1>
              <p className="text-muted-foreground text-base md:text-lg mt-2 max-w-md mx-auto">
                {step.subtitle}
              </p>
            </div>

            {/* Step content */}
            <div className="flex-1 px-4 pb-8 md:pb-12">
              <div className="max-w-xl mx-auto">
                {/* Step 1: Business Basics */}
                {step.id === "business-basics" && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium">
                        Firmenname
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        placeholder="z.B. Muster GmbH"
                        className="h-14 text-lg rounded-xl"
                        autoFocus
                      />
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Rechtsform</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {LEGAL_FORMS.map((form) => (
                          <button
                            key={form.value}
                            type="button"
                            onClick={() => updateField("legalForm", form.value)}
                            className={cn(
                              "p-4 rounded-xl border-2 text-left transition-all",
                              "hover:border-foreground/30 hover:shadow-sm",
                              formData.legalForm === form.value
                                ? "border-foreground bg-muted shadow-sm"
                                : "border-border bg-background"
                            )}
                          >
                            <span className="font-medium">{form.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Branche</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {INDUSTRIES.map((ind) => (
                          <button
                            key={ind.value}
                            type="button"
                            onClick={() => updateField("industry", ind.value)}
                            className={cn(
                              "p-4 rounded-xl border-2 text-left transition-all",
                              "hover:border-foreground/30 hover:shadow-sm",
                              formData.industry === ind.value
                                ? "border-foreground bg-muted shadow-sm"
                                : "border-border bg-background"
                            )}
                          >
                            <span className="font-medium">{ind.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Accounting Setup */}
                {step.id === "accounting-setup" && (
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <Label htmlFor="vatNumber" className="text-sm font-medium">
                        UID / MwSt-Nummer
                      </Label>
                      <Input
                        id="vatNumber"
                        value={formData.vatNumber}
                        onChange={(e) => updateField("vatNumber", e.target.value)}
                        placeholder="CHE-xxx.xxx.xxx"
                        className="h-14 text-lg rounded-xl"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="flex items-center gap-4 p-4 rounded-xl border-2 border-border cursor-pointer hover:border-foreground/30 transition-colors">
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
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="space-y-4 pl-4 border-l-2 border-muted"
                        >
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
                                    "hover:border-foreground/30",
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
                                    "hover:border-foreground/30",
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
                        </motion.div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Geschäftsjahr beginnt im</Label>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                        {MONTHS.map((month, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => updateField("fiscalYearStart", i + 1)}
                            className={cn(
                              "p-3 rounded-xl border-2 text-center text-sm transition-all",
                              "hover:border-foreground/30",
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
                        "border-2 border-dashed rounded-2xl p-8 md:p-12 text-center cursor-pointer transition-all",
                        isDragging
                          ? "border-foreground bg-muted"
                          : "border-border hover:border-foreground/30 hover:bg-muted/50"
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
                      <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                      <p className="font-medium text-lg">
                        Belege hierher ziehen
                      </p>
                      <p className="text-muted-foreground mt-1">
                        oder klicken zum Auswählen
                      </p>
                      <p className="text-xs text-muted-foreground mt-4">
                        PDF, JPG, PNG - max. 10MB pro Datei
                      </p>
                    </div>

                    {uploadedFiles.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          {uploadedFiles.length} Datei{uploadedFiles.length > 1 ? "en" : ""} hochgeladen
                        </p>
                        <div className="space-y-2">
                          {uploadedFiles.map((file) => {
                            const FileIcon = getFileIcon(file.type);
                            return (
                              <div
                                key={file.id}
                                className="flex items-center gap-3 p-3 rounded-xl bg-muted"
                              >
                                <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                                <span className="flex-1 truncate text-sm">{file.name}</span>
                                <button
                                  onClick={() => removeFile(file.id)}
                                  className="p-1 hover:bg-background rounded-lg transition-colors"
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground text-center">
                      Sie können diesen Schritt überspringen und später Belege hochladen
                    </p>
                  </div>
                )}

                {/* Step 4: Business Questions (Chat) */}
                {step.id === "business-questions" && (
                  <div className="flex flex-col h-[400px] md:h-[450px]">
                    <div className="flex-1 overflow-y-auto space-y-4 mb-4">
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
                              "max-w-[85%] p-4 rounded-2xl",
                              message.role === "user"
                                ? "bg-foreground text-background rounded-br-md"
                                : "bg-muted rounded-bl-md"
                            )}
                          >
                            <p className="text-sm md:text-base">{message.content}</p>
                          </div>
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="bg-muted p-4 rounded-2xl rounded-bl-md">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                              <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                              <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder="Ihre Antwort..."
                        className="h-12 rounded-xl"
                        disabled={isTyping}
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!chatInput.trim() || isTyping}
                        size="lg"
                        className="h-12 px-4 rounded-xl"
                      >
                        <Send className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 5: Intelligence Review */}
                {step.id === "intelligence-review" && (
                  <div className="space-y-6">
                    {isAnalyzing ? (
                      <div className="text-center py-12">
                        <Loader2 className="h-10 w-10 mx-auto mb-4 animate-spin text-muted-foreground" />
                        <p className="text-lg font-medium">Analysiere Ihre Daten...</p>
                        <p className="text-muted-foreground mt-1">
                          Die KI erstellt Vorschläge basierend auf Ihren Angaben
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            {aiSuggestions.filter((s) => s.status !== "pending").length} von {aiSuggestions.length} bewertet
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetSuggestions}
                            className="text-muted-foreground"
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
                                "p-4 rounded-xl border-2 transition-all",
                                suggestion.status === "accepted" && "border-green-500/50 bg-green-50/50 dark:bg-green-950/20",
                                suggestion.status === "rejected" && "border-red-500/50 bg-red-50/50 dark:bg-red-950/20",
                                suggestion.status === "pending" && "border-border"
                              )}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium px-2 py-0.5 bg-muted rounded-full">
                                      {suggestion.category}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {Math.round(suggestion.confidence * 100)}% Konfidenz
                                    </span>
                                  </div>
                                  <p className="font-medium">{suggestion.suggestion}</p>
                                </div>

                                {suggestion.status === "pending" ? (
                                  <div className="flex gap-2 shrink-0">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => updateSuggestion(suggestion.id, "rejected")}
                                      className="h-9 w-9 p-0 rounded-xl"
                                    >
                                      <ThumbsDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => updateSuggestion(suggestion.id, "accepted")}
                                      className="h-9 w-9 p-0 rounded-xl"
                                    >
                                      <ThumbsUp className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className={cn(
                                    "flex items-center justify-center h-9 w-9 rounded-xl shrink-0",
                                    suggestion.status === "accepted" ? "bg-green-500" : "bg-red-500"
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
                    <div className="rounded-2xl border border-border overflow-hidden">
                      <div className="px-4 py-3 bg-muted border-b border-border">
                        <p className="font-medium">Zusammenfassung</p>
                      </div>
                      <div className="divide-y divide-border">
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
                          value={`${uploadedFiles.length} hochgeladen`}
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

                    <div className="p-4 rounded-2xl bg-muted/50 border border-border">
                      <div className="flex gap-3">
                        <Sparkles className="h-5 w-5 text-foreground shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Bereit zum Start</p>
                          <p className="text-sm text-muted-foreground mt-1">
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
      <footer className="sticky bottom-0 bg-background border-t border-border">
        <div className="flex items-center justify-end px-4 py-4 md:px-6 max-w-xl mx-auto">
          {currentStep === STEPS.length - 1 ? (
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 h-12 rounded-xl text-base"
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
              className="px-8 h-12 rounded-xl text-base"
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
    <div className="flex items-center justify-between px-4 py-3">
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
