"use client";
import { useStore } from "@/lib/store";
import type { ConnectionStatus, Me } from "@/lib/types";
import { Settings, Timer as TimerIcon, Loader2, Sun, Moon, Command } from "lucide-react";

export function Header({
  me,
  status,
  connecting,
  connError,
  onOpenSettings,
  onOpenPalette,
}: {
  me: Me | null;
  status: ConnectionStatus | null;
  connecting: boolean;
  connError: string | null;
  onOpenSettings: () => void;
  onOpenPalette: () => void;
}) {
  const theme = useStore((s) => s.settings.theme);
  const setTheme = useStore((s) => s.setTheme);

  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent)] shadow-lg shadow-[var(--color-accent)]/30">
          <TimerIcon size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight">Time Tracker</h1>
          <p className="text-xs leading-tight text-[var(--color-faint)]">Jira worklogs, the easy way</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ConnectionChip me={me} connecting={connecting} connError={connError} />
        <button className="btn btn-ghost !px-2.5 max-sm:hidden" onClick={onOpenPalette} title="Command palette (Ctrl/⌘ K)">
          <Command size={15} />
          <span className="text-xs text-[var(--color-faint)]">K</span>
        </button>
        <button className="btn btn-ghost !px-2.5" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Toggle theme">
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className="btn btn-ghost !px-2.5" onClick={onOpenSettings} title="Settings">
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}

function ConnectionChip({ me, connecting, connError }: { me: Me | null; connecting: boolean; connError: string | null }) {
  if (connecting) {
    return (
      <span className="chip">
        <Loader2 size={11} className="animate-spin" /> Connecting…
      </span>
    );
  }
  if (me) {
    return (
      <span className="chip max-sm:hidden" title={me.emailAddress}>
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-green)]" />
        {me.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.avatarUrl} alt="" className="-ml-0.5 h-4 w-4 rounded-full" />
        )}
        {me.displayName}
      </span>
    );
  }
  return (
    <span className="chip" style={{ color: "var(--color-red)" }} title={connError ?? undefined}>
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-red)]" />
      Not connected
    </span>
  );
}
