"use client";
import { fmtDuration } from "@/lib/format";

function Ring({ seconds, goalHours, label }: { seconds: number; goalHours: number; label: string }) {
  const goalSeconds = Math.max(1, goalHours * 3600);
  const pct = Math.min(1, seconds / goalSeconds);
  const r = 26;
  const circ = 2 * Math.PI * r;
  const done = pct >= 1;
  const color = done ? "var(--color-green)" : "var(--color-accent)";

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-[64px] w-[64px]">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-border)" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            style={{ transition: "stroke-dashoffset .5s ease" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
          {Math.round(pct * 100)}%
        </span>
      </div>
      <div>
        <div className="text-xs text-[var(--color-muted)]">{label}</div>
        <div className="font-mono text-lg font-semibold tabular-nums leading-tight">{fmtDuration(seconds)}</div>
        <div className="text-xs text-[var(--color-faint)]">of {goalHours}h goal</div>
      </div>
    </div>
  );
}

export function StatsBar({
  todaySeconds,
  weekSeconds,
  dailyGoalHours,
  weeklyGoalHours,
  loading,
}: {
  todaySeconds: number;
  weekSeconds: number;
  dailyGoalHours: number;
  weeklyGoalHours: number;
  loading: boolean;
}) {
  return (
    <div className={`panel flex items-center gap-8 px-5 py-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
      <Ring seconds={todaySeconds} goalHours={dailyGoalHours} label="Today" />
      <div className="h-12 w-px bg-[var(--color-border)]" />
      <Ring seconds={weekSeconds} goalHours={weeklyGoalHours} label="This week" />
    </div>
  );
}
