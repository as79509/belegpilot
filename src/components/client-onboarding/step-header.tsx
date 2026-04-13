"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StepHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

export function StepHeader({ icon: Icon, title, subtitle }: StepHeaderProps) {
  return (
    <div className="px-4 pt-8 pb-6 md:pt-12 md:pb-8 text-center max-w-2xl mx-auto w-full">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-200/80 mb-4"
      >
        <Icon className="h-6 w-6 text-slate-700" />
      </motion.div>
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 text-balance">
        {title}
      </h1>
      <p className="text-slate-500 text-base mt-2 max-w-md mx-auto">
        {subtitle}
      </p>
    </div>
  );
}
