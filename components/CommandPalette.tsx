"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { JiraIssue } from "@/lib/types";
import { Play, Square, Clock3, CloudUpload, Settings, SunMoon, RefreshCw, Search } from "lucide-react";

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  issues,
  onSync,
  onSettings,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  issues: JiraIssue[];
  onSync: () => void;
  onSettings: () => void;
  onRefresh: () => void;
}) {
  const startTimer = useStore((s) => s.startTimer);
  const stopTimer = useStore((s) => s.stopTimer);
  const setTheme = useStore((s) => s.setTheme);
  const theme = useStore((s) => s.settings.theme);
  const timer = useStore((s) => s.timer);

  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const commands = useMemo<Cmd[]>(() => {
    const base: Cmd[] = [
      timer
        ? { id: "stop", label: "Stop timer", icon: <Square size={15} />, run: () => stopTimer() }
        : { id: "start", label: "Start timer…", hint: "type an issue key", icon: <Play size={15} />, run: () => {} },
      { id: "sync", label: "Sync to Jira", icon: <CloudUpload size={15} />, run: onSync },
      { id: "refresh", label: "Refresh issues", icon: <RefreshCw size={15} />, run: onRefresh },
      { id: "theme", label: `Switch to ${theme === "dark" ? "light" : "dark"} theme`, icon: <SunMoon size={15} />, run: () => setTheme(theme === "dark" ? "light" : "dark") },
      { id: "settings", label: "Open settings", icon: <Settings size={15} />, run: onSettings },
    ];

    const query = q.trim();
    const matchedActions = base.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));

    // Issue results: start a timer on a matched assigned issue, or any typed key.
    const issueCmds: Cmd[] = [];
    const ql = query.toLowerCase();
    if (query) {
      for (const i of issues) {
        if (i.key.toLowerCase().includes(ql) || i.summary.toLowerCase().includes(ql)) {
          issueCmds.push({
            id: `issue-${i.key}`,
            label: `Start timer · ${i.key}`,
            hint: i.summary,
            icon: <Clock3 size={15} />,
            run: () => startTimer(i.key, i.summary),
          });
        }
        if (issueCmds.length >= 6) break;
      }
      const asKey = query.toUpperCase();
      if (/^[A-Z][A-Z0-9]+-\d+$/.test(asKey) && !issueCmds.some((c) => c.id === `issue-${asKey}`)) {
        issueCmds.unshift({ id: `key-${asKey}`, label: `Start timer · ${asKey}`, hint: "typed key", icon: <Play size={15} />, run: () => startTimer(asKey) });
      }
    }

    return query ? [...issueCmds, ...matchedActions] : base;
  }, [q, issues, timer, theme, onSync, onRefresh, onSettings, startTimer, stopTimer, setTheme]);

  useEffect(() => setSel(0), [q]);
  if (!open) return null;

  const run = (c: Cmd) => {
    c.run();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="panel mt-[12vh] w-full max-w-lg overflow-hidden p-0 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSel((s) => Math.min(commands.length - 1, s + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSel((s) => Math.max(0, s - 1));
          } else if (e.key === "Enter" && commands[sel]) {
            e.preventDefault();
            run(commands[sel]);
          } else if (e.key === "Escape") {
            onClose();
          }
        }}
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4">
          <Search size={16} className="text-[var(--color-faint)]" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a command or issue key…" className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-[var(--color-faint)]" />
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {commands.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-[var(--color-muted)]">No matches</li>
          ) : (
            commands.map((c, i) => (
              <li key={c.id}>
                <button
                  onMouseEnter={() => setSel(i)}
                  onClick={() => run(c)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${i === sel ? "bg-[var(--color-surface-2)]" : ""}`}
                >
                  <span className="text-[var(--color-muted)]">{c.icon}</span>
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="truncate text-xs text-[var(--color-faint)]">{c.hint}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
