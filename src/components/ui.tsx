import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn, documentStatusTone } from "@/lib/utils";

export function PageSection(props: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{props.title}</h2>
          {props.subtitle ? <p className="mt-1 text-sm text-slate-500">{props.subtitle}</p> : null}
        </div>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}

export function SectionCard(props: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export function StatusPill(props: { status: string }) {
  const tone = documentStatusTone(props.status);

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
        tone === "success" && "bg-emerald-100 text-emerald-700",
        tone === "warning" && "bg-amber-100 text-amber-700",
        tone === "muted" && "bg-slate-200 text-slate-700",
        tone === "info" && "bg-blue-100 text-blue-700",
      )}
    >
      {props.status}
    </span>
  );
}

export function EmptyState(props: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <SectionCard className="py-10 text-center">
      <h3 className="text-base font-semibold text-slate-950">{props.title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">{props.description}</p>
      {props.actionHref && props.actionLabel ? (
        <Link
          href={props.actionHref}
          className="mt-4 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          {props.actionLabel}
        </Link>
      ) : null}
    </SectionCard>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100",
        props.className,
      )}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100",
        props.className,
      )}
    />
  );
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100",
        props.className,
      )}
    />
  );
}

export function Field(props: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{props.label}</span>
      {props.children}
      {props.hint ? <span className="block text-xs text-slate-500">{props.hint}</span> : null}
    </label>
  );
}

export function PrimaryButton(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode },
) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300",
        props.className,
      )}
    >
      {props.children}
    </button>
  );
}

export function SecondaryButton(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode },
) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400",
        props.className,
      )}
    >
      {props.children}
    </button>
  );
}
