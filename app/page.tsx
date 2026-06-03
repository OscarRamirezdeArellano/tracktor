"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { getAuthStatus, fetchMe, fetchIssues, fetchWorklogs, pushWorklog } from "@/lib/client";
import { toast } from "@/lib/toast";
import { useApplyTheme, useTabTitle, useIdleNudge } from "@/lib/hooks";
import { addDays, startOfWeek, ymd } from "@/lib/format";
import type { ConnectionStatus, JiraIssue, Me, RemoteWorklog } from "@/lib/types";
import { Header } from "@/components/Header";
import { StatsBar } from "@/components/StatsBar";
import { TimerCard } from "@/components/TimerCard";
import { IssueList } from "@/components/IssueList";
import { EntryList } from "@/components/EntryList";
import { TimesheetView } from "@/components/TimesheetView";
import { SettingsDialog } from "@/components/SettingsDialog";
import { CommandPalette } from "@/components/CommandPalette";
import { Toaster } from "@/components/Toaster";

export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="min-h-screen bg-[var(--color-bg)]" />;
  return <App />;
}

function App() {
  useApplyTheme();
  useTabTitle();
  useIdleNudge(4);

  const entries = useStore((s) => s.entries);
  const markSynced = useStore((s) => s.markSynced);
  const markSyncError = useStore((s) => s.markSyncError);
  const settings = useStore((s) => s.settings);

  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [connError, setConnError] = useState<string | null>(null);

  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  const [weekWorklogs, setWeekWorklogs] = useState<RemoteWorklog[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const loadIssues = useCallback(async () => {
    setIssuesLoading(true);
    setIssuesError(null);
    try {
      setIssues(await fetchIssues());
    } catch (e) {
      setIssuesError((e as Error).message);
    } finally {
      setIssuesLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const weekStart = startOfWeek(new Date());
      setWeekWorklogs(await fetchWorklogs(ymd(weekStart), ymd(addDays(weekStart, 6))));
    } catch {
      /* stats are best-effort */
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setConnError(null);
    try {
      const st = await getAuthStatus();
      setStatus(st);
      if (!st.configured) {
        setMe(null);
        setSettingsOpen(true);
        return;
      }
      setMe(await fetchMe());
      loadIssues();
      loadStats();
    } catch (e) {
      setMe(null);
      setConnError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }, [loadIssues, loadStats]);

  useEffect(() => {
    connect();
  }, [connect]);

  // Cmd/Ctrl+K opens the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const syncAll = useCallback(async () => {
    const pending = useStore.getState().entries.filter((e) => !e.synced);
    if (pending.length === 0) return;
    setSyncing(true);
    let ok = 0;
    let fail = 0;
    for (const e of pending) {
      try {
        const id = await pushWorklog(e);
        markSynced(e.id, id);
        ok++;
      } catch (err) {
        markSyncError(e.id, (err as Error).message);
        fail++;
      }
    }
    setSyncing(false);
    if (ok) toast.success(`Synced ${ok} ${ok === 1 ? "entry" : "entries"} to Jira`);
    if (fail) toast.error(`${fail} ${fail === 1 ? "entry" : "entries"} failed — check the time log`);
    loadIssues();
    loadStats();
    setReloadToken((t) => t + 1);
  }, [markSynced, markSyncError, loadIssues, loadStats]);

  // Stats: remote (authoritative for synced) + local pending only, to avoid double-counting.
  const { todaySeconds, weekSeconds } = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    const weekKeys = new Set(Array.from({ length: 7 }, (_, i) => ymd(addDays(weekStart, i))));
    const todayKey = ymd(new Date());
    let today = 0;
    let week = 0;
    for (const w of weekWorklogs) {
      const k = ymd(new Date(w.started));
      if (weekKeys.has(k)) week += w.seconds;
      if (k === todayKey) today += w.seconds;
    }
    for (const e of entries) {
      if (e.synced) continue;
      const k = ymd(new Date(e.started));
      if (weekKeys.has(k)) week += e.seconds;
      if (k === todayKey) today += e.seconds;
    }
    return { todaySeconds: today, weekSeconds: week };
  }, [weekWorklogs, entries]);

  const pendingCount = entries.filter((e) => !e.synced).length;
  const connected = Boolean(me);

  return (
    <div className="page-glow relative min-h-screen">
      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
        <Header me={me} status={status} connecting={connecting} connError={connError} onOpenSettings={() => setSettingsOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />

        {!connecting && !me && (
          <button
            onClick={() => setSettingsOpen(true)}
            className="mt-6 w-full rounded-xl border border-dashed border-[var(--color-border-strong)] px-4 py-3 text-left text-sm transition-colors hover:border-[var(--color-accent)]"
          >
            <span className="font-medium text-[var(--color-amber)]">Connect your Jira account</span>
            <span className="text-[var(--color-muted)]"> — {connError ?? "add your site, email and API token to get started."}</span>
          </button>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_auto]">
          <TimerCard issues={issues} />
          {connected && (
            <StatsBar todaySeconds={todaySeconds} weekSeconds={weekSeconds} dailyGoalHours={settings.dailyGoalHours} weeklyGoalHours={settings.weeklyGoalHours} loading={statsLoading} />
          )}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <IssueList issues={issues} loading={issuesLoading} error={issuesError} onRefresh={loadIssues} />
          <EntryList syncing={syncing} onSync={syncAll} />
        </div>

        {connected && (
          <div className="mt-5">
            <TimesheetView connected={connected} reloadToken={reloadToken} />
          </div>
        )}

        <footer className="mt-8 flex items-center justify-between text-xs text-[var(--color-faint)]">
          <span>{pendingCount > 0 ? `${pendingCount} entr${pendingCount === 1 ? "y" : "ies"} waiting to sync` : "All caught up"}</span>
          <span>Local-first · ⌘K for commands</span>
        </footer>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} status={status} onChanged={connect} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} issues={issues} onSync={syncAll} onSettings={() => setSettingsOpen(true)} onRefresh={loadIssues} />
      <Toaster />
    </div>
  );
}
