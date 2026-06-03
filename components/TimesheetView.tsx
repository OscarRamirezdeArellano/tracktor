"use client";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fetchWorklogs } from "@/lib/client";
import { addDays, fmtDuration, startOfWeek, ymd } from "@/lib/format";
import type { RemoteWorklog } from "@/lib/types";
import { CalendarRange, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Row {
  issueKey: string;
  summary?: string;
  perDay: number[]; // 7
  pendingDays: boolean[]; // 7
  total: number;
}

export function TimesheetView({ connected, reloadToken }: { connected: boolean; reloadToken: number }) {
  const entries = useStore((s) => s.entries);
  const [offset, setOffset] = useState(0);
  const [remote, setRemote] = useState<RemoteWorklog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), offset * 7), [offset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const from = ymd(weekStart);
  const to = ymd(days[6]);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWorklogs(from, to)
      .then((w) => !cancelled && setRemote(w))
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [connected, from, to, reloadToken]);

  const { rows, dayTotals, weekTotal } = useMemo(() => {
    const map = new Map<string, Row>();
    const dayKeys = days.map(ymd);
    const ensure = (key: string, summary?: string) => {
      let r = map.get(key);
      if (!r) {
        r = { issueKey: key, summary, perDay: [0, 0, 0, 0, 0, 0, 0], pendingDays: [false, false, false, false, false, false, false], total: 0 };
        map.set(key, r);
      }
      if (summary && !r.summary) r.summary = summary;
      return r;
    };
    const dayIndex = (iso: string) => dayKeys.indexOf(ymd(new Date(iso)));

    for (const w of remote) {
      const i = dayIndex(w.started);
      if (i < 0) continue;
      const r = ensure(w.issueKey, w.summary);
      r.perDay[i] += w.seconds;
      r.total += w.seconds;
    }
    // local pending entries (not yet in Jira) within this week
    for (const e of entries) {
      if (e.synced) continue;
      const i = dayIndex(e.started);
      if (i < 0) continue;
      const r = ensure(e.issueKey, e.summary);
      r.perDay[i] += e.seconds;
      r.pendingDays[i] = true;
      r.total += e.seconds;
    }

    const rows = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    rows.forEach((r) => r.perDay.forEach((s, i) => (dayTotals[i] += s)));
    const weekTotal = dayTotals.reduce((a, b) => a + b, 0);
    return { rows, dayTotals, weekTotal };
  }, [remote, entries, days]);

  const todayKey = ymd(new Date());
  const rangeLabel = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <section className="panel flex flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarRange size={15} className="text-[var(--color-muted)]" /> Timesheet
          {loading ? <Loader2 size={13} className="animate-spin text-[var(--color-faint)]" /> : <span className="chip">{fmtDuration(weekTotal)}</span>}
        </h2>
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost !px-2 !py-1.5" onClick={() => setOffset((o) => o - 1)} title="Previous week">
            <ChevronLeft size={14} />
          </button>
          <button className="btn btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => setOffset(0)} disabled={offset === 0}>
            {offset === 0 ? "This week" : rangeLabel}
          </button>
          <button className="btn btn-ghost !px-2 !py-1.5" onClick={() => setOffset((o) => o + 1)} title="Next week">
            <ChevronRight size={14} />
          </button>
        </div>
      </header>

      <div className="overflow-x-auto p-2">
        {error ? (
          <p className="px-3 py-6 text-center text-sm text-[var(--color-red)]">{error}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-xs text-[var(--color-muted)]">
                <th className="px-2 py-1.5 text-left font-medium">Issue</th>
                {days.map((d) => (
                  <th key={ymd(d)} className={`px-2 py-1.5 text-right font-medium tabular-nums ${ymd(d) === todayKey ? "text-[var(--color-accent)]" : ""}`}>
                    {DAY_LABELS[(d.getDay() + 6) % 7]}
                    <span className="ml-1 text-[var(--color-faint)]">{d.getDate()}</span>
                  </th>
                ))}
                <th className="px-2 py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-xs text-[var(--color-muted)]">
                    No time logged this week yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.issueKey} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]">
                    <td className="max-w-[14rem] px-2 py-2">
                      <div className="font-mono text-xs font-semibold text-[var(--color-accent)]">{r.issueKey}</div>
                      {r.summary && <div className="truncate text-xs text-[var(--color-muted)]">{r.summary}</div>}
                    </td>
                    {r.perDay.map((s, i) => (
                      <td key={i} className="px-2 py-2 text-right font-mono text-xs tabular-nums">
                        {s > 0 ? (
                          <span className={r.pendingDays[i] ? "text-[var(--color-amber)]" : ""} title={r.pendingDays[i] ? "Includes pending (unsynced) time" : undefined}>
                            {fmtDuration(s)}
                          </span>
                        ) : (
                          <span className="text-[var(--color-faint)]">·</span>
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right font-mono text-xs font-semibold tabular-nums">{fmtDuration(r.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--color-border-strong)] text-xs font-semibold">
                  <td className="px-2 py-2 text-[var(--color-muted)]">Total</td>
                  {dayTotals.map((s, i) => (
                    <td key={i} className="px-2 py-2 text-right font-mono tabular-nums">
                      {s > 0 ? fmtDuration(s) : <span className="text-[var(--color-faint)]">·</span>}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-[var(--color-accent)]">{fmtDuration(weekTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </section>
  );
}
