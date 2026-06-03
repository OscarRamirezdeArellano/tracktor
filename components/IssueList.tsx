"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { searchIssues } from "@/lib/client";
import { toast } from "@/lib/toast";
import type { JiraIssue } from "@/lib/types";
import { Play, RefreshCw, ListTodo, AlertCircle, Search, Pin, Loader2, X } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  new: "var(--color-faint)",
  indeterminate: "var(--color-accent)",
  done: "var(--color-green)",
};

export function IssueList({
  issues,
  loading,
  error,
  onRefresh,
}: {
  issues: JiraIssue[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const timer = useStore((s) => s.timer);
  const startTimer = useStore((s) => s.startTimer);
  const pinned = useStore((s) => s.pinned);
  const togglePin = useStore((s) => s.togglePin);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<JiraIssue[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      setSearchError(null);
      return;
    }
    setSearching(true);
    const id = setTimeout(() => {
      searchIssues(query)
        .then(setResults)
        .catch((e) => setSearchError((e as Error).message))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(id);
  }, [q]);

  const start = (i: JiraIssue) => {
    if (timer) return toast.error("Stop the running timer first.");
    startTimer(i.key, i.summary);
    toast.info(`Started timer for ${i.key}`);
  };

  const searchMode = q.trim().length > 0;
  const list = searchMode ? results : issues;
  const busy = searchMode ? searching : loading;
  const err = searchMode ? searchError : error;

  return (
    <section className="panel flex min-h-[18rem] max-h-[min(34rem,calc(100vh_-_9rem))] flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ListTodo size={15} className="text-[var(--color-muted)]" /> {searchMode ? "Search results" : "Assigned to me"}
          {!searchMode && issues.length > 0 && <span className="chip">{issues.length}</span>}
        </h2>
        <button className="btn btn-ghost !px-2 !py-1.5" onClick={onRefresh} disabled={loading} title="Refresh">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="border-b border-[var(--color-border)] px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-[var(--color-bg-elevated)] px-2.5">
          <Search size={14} className="text-[var(--color-faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any issue…" className="w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-[var(--color-faint)]" />
          {searching ? <Loader2 size={13} className="animate-spin text-[var(--color-faint)]" /> : q && <button onClick={() => setQ("")} className="text-[var(--color-faint)] hover:text-[var(--color-text)]"><X size={14} /></button>}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {err ? (
          <Empty icon={<AlertCircle size={20} className="text-[var(--color-red)]" />} title="Something went wrong" sub={err} />
        ) : busy && list.length === 0 ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--color-surface-2)]" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <Empty
            icon={<ListTodo size={20} className="text-[var(--color-faint)]" />}
            title={searchMode ? "No matches" : "Nothing assigned"}
            sub={searchMode ? "Try a different search term or an issue key." : "No open issues are assigned to you right now."}
          />
        ) : (
          <ul className="space-y-0.5">
            {list.map((i) => (
              <li key={i.key} className="group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--color-surface-2)]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[i.statusCategory] ?? "var(--color-faint)" }} title={i.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[var(--color-accent)]">{i.key}</span>
                    <span className="truncate text-xs text-[var(--color-faint)]">{i.status}</span>
                    {i.duedate && <span className="chip !text-[var(--color-amber)]">due {i.duedate}</span>}
                  </div>
                  <div className="mt-0.5 truncate text-sm">{i.summary}</div>
                </div>
                <button
                  onClick={() => togglePin(i.key)}
                  className={`btn btn-ghost !border-transparent !px-2 !py-1.5 ${pinned.includes(i.key) ? "text-[var(--color-accent)]" : "opacity-0 group-hover:opacity-100"}`}
                  title={pinned.includes(i.key) ? "Unpin" : "Pin for quick access"}
                >
                  <Pin size={13} />
                </button>
                <button onClick={() => start(i)} className="btn btn-ghost !px-2.5 !py-1.5 opacity-0 transition-opacity group-hover:opacity-100" title="Start timer">
                  <Play size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Empty({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icon}
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-xs text-[var(--color-muted)]">{sub}</p>
    </div>
  );
}
