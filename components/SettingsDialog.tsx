"use client";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { saveCredentials, disconnect } from "@/lib/client";
import { exportCsv, exportJson, parseImport } from "@/lib/exporters";
import { toast } from "@/lib/toast";
import type { ConnectionStatus } from "@/lib/types";
import { X, Loader2, ExternalLink, Download, Upload, Plug, Unplug } from "lucide-react";

export function SettingsDialog({
  open,
  onClose,
  status,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  status: ConnectionStatus | null;
  onChanged: () => void;
}) {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const entries = useStore((s) => s.entries);
  const importEntries = useStore((s) => s.importEntries);

  const [baseUrl, setBaseUrl] = useState(status?.baseUrl ?? "");
  const [email, setEmail] = useState(status?.email ?? "");
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [replaceOnImport, setReplaceOnImport] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const envManaged = status?.source === "env";

  const connect = async () => {
    setSaving(true);
    try {
      const me = await saveCredentials({ baseUrl, email, apiToken });
      toast.success(`Connected as ${me.displayName}`);
      setApiToken("");
      onChanged();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const unlink = async () => {
    await disconnect();
    setBaseUrl("");
    setEmail("");
    setApiToken("");
    toast.info("Disconnected");
    onChanged();
  };

  const onImportFile = async (file: File) => {
    try {
      const parsed = parseImport(await file.text());
      importEntries(parsed, replaceOnImport ? "replace" : "merge");
      toast.success(`Imported ${parsed.length} entries`);
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="panel my-[6vh] w-full max-w-lg p-6 shadow-2xl shadow-black/50">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="text-[var(--color-faint)] hover:text-[var(--color-text)]">
            <X size={18} />
          </button>
        </div>

        {/* Connection */}
        <Section title="Jira connection">
          {envManaged ? (
            <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2.5 text-sm text-[var(--color-muted)]">
              Connected via server environment variables as <span className="text-[var(--color-text)]">{status?.email}</span>. To change, update
              the deployment&apos;s env vars.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-[var(--color-faint)]">Stored in a secure httpOnly cookie — never exposed to page scripts.</p>
              <div className="space-y-3">
                <input className="input" placeholder="https://yourcompany.atlassian.net" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
                <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="input font-mono" type="password" placeholder={status?.configured ? "•••••••• (unchanged)" : "API token"} value={apiToken} onChange={(e) => setApiToken(e.target.value)} />
                <div className="flex items-center justify-between">
                  <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline">
                    Create an API token <ExternalLink size={11} />
                  </a>
                  <div className="flex gap-2">
                    {status?.configured && (
                      <button className="btn btn-ghost btn-danger" onClick={unlink}>
                        <Unplug size={14} /> Disconnect
                      </button>
                    )}
                    <button className="btn btn-primary" onClick={connect} disabled={saving || !baseUrl || !email || !apiToken}>
                      {saving ? <Loader2 size={15} className="animate-spin" /> : <Plug size={14} />} Connect
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </Section>

        {/* Preferences */}
        <Section title="Preferences">
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Hours / day" value={settings.hoursPerDay} onChange={(v) => setSettings({ hoursPerDay: v })} />
            <NumberField label="Daily goal (h)" value={settings.dailyGoalHours} onChange={(v) => setSettings({ dailyGoalHours: v })} />
            <NumberField label="Weekly goal (h)" value={settings.weeklyGoalHours} onChange={(v) => setSettings({ weeklyGoalHours: v })} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm font-medium">Theme</span>
            <div className="inline-flex rounded-lg border border-[var(--color-border)] p-0.5 text-sm">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSettings({ theme: t })}
                  className={`rounded-[7px] px-3 py-1 capitalize ${settings.theme === t ? "bg-[var(--color-surface-2)]" : "text-[var(--color-muted)]"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Data */}
        <Section title="Data" last>
          <p className="mb-3 text-xs text-[var(--color-faint)]">Your entries live in this browser. Back them up or move them to another device.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-ghost" onClick={() => exportCsv(entries)} disabled={!entries.length}>
              <Download size={14} /> Export CSV
            </button>
            <button className="btn btn-ghost" onClick={() => exportJson(entries)} disabled={!entries.length}>
              <Download size={14} /> Export JSON
            </button>
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Import JSON
            </button>
            <label className="ml-1 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
              <input type="checkbox" checked={replaceOnImport} onChange={(e) => setReplaceOnImport(e.target.checked)} /> replace existing
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportFile(f);
                e.target.value = "";
              }}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={last ? "" : "mb-5 border-b border-[var(--color-border)] pb-5"}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-faint)]">{title}</h3>
      {children}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">{label}</span>
      <input className="input" type="number" min={1} value={value} onChange={(e) => onChange(Number(e.target.value) || value)} />
    </label>
  );
}
