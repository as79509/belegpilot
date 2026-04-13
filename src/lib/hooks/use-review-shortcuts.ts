"use client";
import { useEffect, useCallback } from "react";

interface ReviewShortcuts {
  onApprove?: () => void;
  onReject?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onEdit?: () => void;
  onSkip?: () => void;
  enabled?: boolean;
}

export function useReviewShortcuts({ onApprove, onReject, onNext, onPrevious, onEdit, onSkip, enabled = true }: ReviewShortcuts) {
  const handler = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    switch (e.key) {
      case "a":
      case "A":
        e.preventDefault();
        onApprove?.();
        break;
      case "r":
      case "R":
        e.preventDefault();
        onReject?.();
        break;
      case "j":
      case "ArrowRight":
        e.preventDefault();
        onNext?.();
        break;
      case "k":
      case "ArrowLeft":
        e.preventDefault();
        onPrevious?.();
        break;
      case "e":
      case "E":
        e.preventDefault();
        onEdit?.();
        break;
      case "s":
      case "S":
        e.preventDefault();
        onSkip?.();
        break;
    }
  }, [onApprove, onReject, onNext, onPrevious, onEdit, onSkip, enabled]);

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}
