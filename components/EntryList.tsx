"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { dayLabel, fmtDuration } from "@/lib/format";
import { deleteWorklog } from "@/lib/client";
import { toast } from "@/lib/toast";
import type { Entry } from "@/lib/types";
import { EditEntryDialog } from "./EditEntryDialog";
import { Trash2, CloudUpload, Check, Loader2, History, Pencil, AlertCircle } from "lucide-react";

export function EntryList({ syncing, onSync }: { syncing: boolean; onSync: () => void }) {
  const entries = useStore((s) => s.entries);
  const removeEntry = useStore((s) => s.removeEntry);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = entries.filter((e) => !e.synced);
  const pendingSeconds = pending.reduce((a, e) => a + e.seconds, 0);
  const totalSeconds = entries.reduce((a, e) => a + e.seconds, 0);
  const failed = entries.filter((e) => e.syncError).length;

  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const k = dayLabel(e.started);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return Array.from(map.entries());
  }, [entries]);

  const del = async (e: Entry) => {
    if (e.synced && e.jiraWorklogId) {
      setBusyId(e.id);
      try {
        await deleteWorklog(e.issueKey, e.jiraWorklogId);
      } catch (err) {
        setBusyId(null);
        return toast.error(`Couldn't delete the Jira worklog: ${(err as Error).message}`);
      }
      setBusyId(null);
    }
    removeEntry(e.id);
  };

  return (
    <section className="panel flex min-h-[18rem] max-h-[min(34rem,calc(100vh_-_9rem))] flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <History size={15} className="text-[var(--color-muted)]" /> Time log
          {totalSeconds > 0 && <span className="chip">{fmtDuration(totalSeconds)}</span>}
        </h2>
        <button className="btn btn-primary !py-1.5" onClick={onSync} disabled={syncing || pending.length === 0}>
          {syncing ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />}
          {pending.length > 0 ? `Sync ${pending.length}` : "Synced"}
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {entries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <History size={20} className="text-[var(--color-faint)]" />
            <p className="text-sm font-medium">No time logged yet</p>
            <p className="max-w-xs text-xs text-[var(--color-muted)]">
              Start the stopwatch or add an entry. It stays here until you sync it to Jira.
            </p>
          </div>
        ) : (
          <div className="space-y-4 p-1">
            {groups.map(([label, items]) => {
              const sum = items.reduce((a, e) => a + e.seconds, 0);
              return (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between px-1.5">
                    <span className="text-xs font-medium text-[var(--color-muted)]">{label}</span>
                    <span className="text-xs text-[var(--color-faint)]">{fmtDuration(sum)}</span>
                  </div>
                  <ul className="space-y-0.5">
                    {items.map((e) => (
                      <li key={e.id} className="group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--color-surface-2)]">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: e.syncError ? "var(--color-red)" : e.synced ? "var(--color-green)" : "var(--color-amber)" }}
                          title={e.syncError ? "Sync failed" : e.synced ? "Synced to Jira" : "Pending sync"}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-[var(--color-accent)]">{e.issueKey}</span>
                            {e.synced && <Check size={12} className="text-[var(--color-green)]" />}
                          </div>
                          {(e.comment || e.summary) && <div className="mt-0.5 truncate text-sm text-[var(--color-muted)]">{e.comment || e.summary}</div>}
                          {e.syncError && (
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-red)]">
                              <AlertCircle size={11} /> {e.syncError}
                            </div>
                          )}
                        </div>
                        <span className="font-mono text-sm tabular-nums">{fmtDuration(e.seconds)}</span>
                        <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                          <button onClick={() => setEditing(e)} className="btn btn-ghost !border-transparent !px-2 !py-1.5" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => del(e)} disabled={busyId === e.id} className="btn btn-ghost btn-danger !border-transparent !px-2 !py-1.5" title={e.synced ? "Delete here and in Jira" : "Delete entry"}>
                            {busyId === e.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(pending.length > 0 || failed > 0) && (
        <footer className="border-t border-[var(--color-border)] px-4 py-2.5 text-xs text-[var(--color-muted)]">
          {failed > 0 && <span className="text-[var(--color-red)]">{failed} failed · </span>}
          <span className="text-[var(--color-amber)]">●</span> {fmtDuration(pendingSeconds)} pending sync to Jira
        </footer>
      )}

      {editing && <EditEntryDialog entry={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}
