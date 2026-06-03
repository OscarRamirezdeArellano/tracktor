"use client";
import { useToasts } from "@/lib/toast";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

const ICONS = {
  success: <CheckCircle2 size={16} className="text-[var(--color-green)]" />,
  error: <AlertCircle size={16} className="text-[var(--color-red)]" />,
  info: <Info size={16} className="text-[var(--color-accent)]" />,
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="fixed bottom-5 right-5 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="panel flex items-start gap-2.5 px-3.5 py-3 shadow-lg shadow-black/40 animate-[fadeIn_.15s_ease-out]"
          style={{ background: "var(--color-surface-2)" }}
        >
          <span className="mt-0.5 shrink-0">{ICONS[t.kind]}</span>
          <p className="flex-1 text-sm leading-snug">{t.message}</p>
          <button onClick={() => dismiss(t.id)} className="shrink-0 text-[var(--color-faint)] hover:text-[var(--color-text)]">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
