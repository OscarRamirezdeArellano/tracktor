"use client";
import { forwardRef, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { fmtClock, fmtDuration, parseDuration, fromDateTimeLocal, toDateTimeLocal } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { JiraIssue } from "@/lib/types";
import { Play, Square, Plus, Clock3, Trash, Pin } from "lucide-react";

export function TimerCard({ issues }: { issues: JiraIssue[] }) {
  const timer = useStore((s) => s.timer);
  const startTimer = useStore((s) => s.startTimer);
  const stopTimer = useStore((s) => s.stopTimer);
  const cancelTimer = useStore((s) => s.cancelTimer);
  const addManualEntry = useStore((s) => s.addManualEntry);
  const hoursPerDay = useStore((s) => s.settings.hoursPerDay);
  const recent = useStore((s) => s.recent);
  const pinned = useStore((s) => s.pinned);

  const [tab, setTab] = useState<"timer" | "manual">("timer");
  const quick = Array.from(new Set([...pinned, ...recent])).slice(0, 6);

  return (
    <div className="panel relative overflow-hidden p-5 sm:p-6">
      {timer ? (
        <RunningTimer
          onStop={(comment) => {
            const e = stopTimer(comment);
            if (e) toast.success(`Logged ${fmtDuration(e.seconds)} to ${e.issueKey}`);
          }}
          onCancel={cancelTimer}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-[var(--color-border)] p-0.5 text-sm">
              <Tab active={tab === "timer"} onClick={() => setTab("timer")}>
                <Play size={13} /> Stopwatch
              </Tab>
              <Tab active={tab === "manual"} onClick={() => setTab("manual")}>
                <Clock3 size={13} /> Log time
              </Tab>
            </div>
            {quick.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {quick.map((k) => (
                  <button
                    key={k}
                    onClick={() => startTimer(k, summaryFor(issues, k))}
                    className="chip font-mono hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
                    title="Start timer"
                  >
                    {pinned.includes(k) && <Pin size={9} />}
                    {k}
                  </button>
                ))}
              </div>
            )}
          </div>
          {tab === "timer" ? (
            <StartForm issues={issues} onStart={(k, c) => startTimer(k, summaryFor(issues, k), c)} />
          ) : (
            <ManualForm
              issues={issues}
              onAdd={(key, dur, comment, startedIso) => {
                const seconds = parseDuration(dur, hoursPerDay);
                if (!seconds) return toast.error("Couldn't read that duration. Try 1h30m, 45m, 1.5h or 1d.");
                addManualEntry({ issueKey: key, summary: summaryFor(issues, key), seconds, started: startedIso, comment });
                toast.success(`Logged ${fmtDuration(seconds)} to ${key.toUpperCase()}`);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function summaryFor(issues: JiraIssue[], key: string) {
  return issues.find((i) => i.key.toUpperCase() === key.toUpperCase())?.summary;
}

function RunningTimer({ onStop, onCancel }: { onStop: (c: string) => void; onCancel: () => void }) {
  const timer = useStore((s) => s.timer)!;
  const [now, setNow] = useState(() => Date.now());
  const [comment, setComment] = useState(timer.comment);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.floor((now - new Date(timer.startedAt).getTime()) / 1000);

  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--color-green)]">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-green)] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-green)]" />
        </span>
        Tracking
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono text-base font-semibold text-[var(--color-accent)]">{timer.issueKey}</div>
          {timer.summary && <div className="mt-0.5 max-w-md truncate text-sm text-[var(--color-muted)]">{timer.summary}</div>}
        </div>
        <div className="font-mono text-5xl font-semibold tabular-nums tracking-tight">{fmtClock(elapsed)}</div>
      </div>

      <input className="input mt-4" placeholder="What are you working on? (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />

      <div className="mt-4 flex gap-2">
        <button className="btn btn-primary flex-1" onClick={() => onStop(comment)}>
          <Square size={15} /> Stop & log
        </button>
        <button className="btn btn-ghost btn-danger" onClick={onCancel} title="Discard this timer">
          <Trash size={15} />
        </button>
      </div>
    </div>
  );
}

function StartForm({ issues, onStart }: { issues: JiraIssue[]; onStart: (key: string, comment: string) => void }) {
  const [key, setKey] = useState("");
  const [comment, setComment] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!key.trim()) return ref.current?.focus();
    onStart(key.trim().toUpperCase(), comment);
    setKey("");
    setComment("");
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <IssueInput ref={ref} issues={issues} value={key} onChange={setKey} onEnter={submit} className="sm:w-44" />
      <input className="input flex-1" placeholder="What are you working on? (optional)" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <button className="btn btn-primary" onClick={submit}>
        <Play size={15} /> Start
      </button>
    </div>
  );
}

function ManualForm({ issues, onAdd }: { issues: JiraIssue[]; onAdd: (key: string, dur: string, comment: string, startedIso: string) => void }) {
  const [key, setKey] = useState("");
  const [dur, setDur] = useState("");
  const [comment, setComment] = useState("");
  const [when, setWhen] = useState(() => toDateTimeLocal(new Date().toISOString()));

  const submit = () => {
    if (!key.trim() || !dur.trim()) return;
    onAdd(key.trim().toUpperCase(), dur, comment, fromDateTimeLocal(when));
    setKey("");
    setDur("");
    setComment("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <IssueInput issues={issues} value={key} onChange={setKey} onEnter={submit} className="sm:w-44" />
        <input className="input sm:w-28" placeholder="1h30m" value={dur} onChange={(e) => setDur(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <input className="input sm:w-52" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} title="When the work happened" />
      </div>
      <div className="flex gap-3">
        <input className="input flex-1" placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <button className="btn btn-primary" onClick={submit} disabled={!key.trim() || !dur.trim()}>
          <Plus size={15} /> Add
        </button>
      </div>
    </div>
  );
}

const IssueInput = forwardRef<
  HTMLInputElement,
  { issues: JiraIssue[]; value: string; onChange: (v: string) => void; onEnter: () => void; className?: string }
>(function IssueInput({ issues, value, onChange, onEnter, className }, ref) {
  const recent = useStore((s) => s.recent);
  const keys = Array.from(new Set([...issues.map((i) => i.key), ...recent]));
  return (
    <>
      <input
        ref={ref}
        className={`input font-mono uppercase ${className ?? ""}`}
        placeholder="ABC-123"
        list="issue-keys"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter()}
      />
      <datalist id="issue-keys">
        {keys.map((k) => (
          <option key={k} value={k}>
            {issues.find((i) => i.key === k)?.summary ?? ""}
          </option>
        ))}
      </datalist>
    </>
  );
});

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 font-medium transition-colors ${
        active ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
      }`}
    >
      {children}
    </button>
  );
}
