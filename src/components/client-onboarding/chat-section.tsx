"use client";

import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
}

interface ChatSectionProps {
  messages: ChatMessage[];
  input: string;
  isTyping: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

export function ChatSection({
  messages,
  input,
  isTyping,
  error,
  onInputChange,
  onSend,
}: ChatSectionProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
      <div className="flex flex-col h-[420px] md:h-[480px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
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
                  <span
                    className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}
          
          {error && (
            <div className="flex justify-center">
              <div className="bg-red-50 text-red-600 text-xs px-3 py-1.5 rounded-full">
                {error}
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        <div className="border-t border-slate-100 p-4 bg-slate-50">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSend()}
              placeholder="Ihre Antwort..."
              className="h-11 rounded-xl border-slate-200 bg-white focus:border-slate-400 focus:ring-slate-400"
              disabled={isTyping}
            />
            <Button
              onClick={onSend}
              disabled={!input.trim() || isTyping}
              size="lg"
              className="h-11 px-4 rounded-xl bg-slate-900 hover:bg-slate-800"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
