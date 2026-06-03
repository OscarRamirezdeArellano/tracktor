"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppSettings, Entry, Theme, Timer } from "./types";

interface State {
  settings: AppSettings;
  entries: Entry[];
  timer: Timer | null;
  pinned: string[]; // issue keys
  recent: string[]; // issue keys, most-recent first

  setSettings: (s: Partial<AppSettings>) => void;
  setTheme: (t: Theme) => void;

  startTimer: (issueKey: string, summary?: string, comment?: string) => void;
  stopTimer: (comment?: string) => Entry | null;
  cancelTimer: () => void;

  addManualEntry: (e: Omit<Entry, "id" | "synced" | "jiraWorklogId" | "syncError">) => void;
  updateEntry: (id: string, patch: Partial<Entry>) => void;
  removeEntry: (id: string) => void;
  markSynced: (id: string, jiraWorklogId: string | null) => void;
  markSyncError: (id: string, error: string) => void;
  importEntries: (entries: Entry[], mode: "merge" | "replace") => void;

  pushRecent: (key: string) => void;
  togglePin: (key: string) => void;
}

const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

const defaultSettings: AppSettings = {
  hoursPerDay: 8,
  dailyGoalHours: 8,
  weeklyGoalHours: 40,
  theme: "dark",
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      entries: [],
      timer: null,
      pinned: [],
      recent: [],

      setSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),
      setTheme: (theme) => set((st) => ({ settings: { ...st.settings, theme } })),

      startTimer: (issueKey, summary, comment = "") => {
        const key = issueKey.toUpperCase();
        get().pushRecent(key);
        set({ timer: { issueKey: key, summary, comment, startedAt: new Date().toISOString() } });
      },

      stopTimer: (comment) => {
        const t = get().timer;
        if (!t) return null;
        const seconds = Math.max(60, Math.round((Date.now() - new Date(t.startedAt).getTime()) / 1000));
        const entry: Entry = {
          id: newId(),
          issueKey: t.issueKey,
          summary: t.summary,
          seconds,
          started: t.startedAt,
          comment: comment ?? t.comment ?? "",
          synced: false,
          jiraWorklogId: null,
          syncError: null,
        };
        set((st) => ({ timer: null, entries: [entry, ...st.entries] }));
        return entry;
      },

      cancelTimer: () => set({ timer: null }),

      addManualEntry: (e) => {
        const key = e.issueKey.toUpperCase();
        get().pushRecent(key);
        set((st) => ({
          entries: [
            { ...e, id: newId(), issueKey: key, synced: false, jiraWorklogId: null, syncError: null },
            ...st.entries,
          ],
        }));
      },

      updateEntry: (id, patch) =>
        set((st) => ({ entries: st.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

      removeEntry: (id) => set((st) => ({ entries: st.entries.filter((e) => e.id !== id) })),

      markSynced: (id, jiraWorklogId) =>
        set((st) => ({
          entries: st.entries.map((e) => (e.id === id ? { ...e, synced: true, jiraWorklogId, syncError: null } : e)),
        })),

      markSyncError: (id, error) =>
        set((st) => ({ entries: st.entries.map((e) => (e.id === id ? { ...e, syncError: error } : e)) })),

      importEntries: (incoming, mode) =>
        set((st) => {
          if (mode === "replace") return { entries: incoming };
          const ids = new Set(st.entries.map((e) => e.id));
          return { entries: [...st.entries, ...incoming.filter((e) => !ids.has(e.id))] };
        }),

      pushRecent: (key) =>
        set((st) => ({ recent: [key, ...st.recent.filter((k) => k !== key)].slice(0, 8) })),

      togglePin: (key) =>
        set((st) => ({
          pinned: st.pinned.includes(key) ? st.pinned.filter((k) => k !== key) : [...st.pinned, key],
        })),
    }),
    {
      name: "jira-tracker",
      version: 2,
      // Older versions stored credentials inside `settings`; strip them on upgrade.
      migrate: (persisted) => {
        const p = (persisted ?? {}) as { settings?: Record<string, unknown> };
        if (p.settings) {
          const { baseUrl, email, apiToken, ...rest } = p.settings;
          void baseUrl;
          void email;
          void apiToken;
          p.settings = rest;
        }
        return p;
      },
      // Tolerate old persisted shapes and fill in any missing keys with defaults.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...(p.settings ?? {}) },
          pinned: p.pinned ?? [],
          recent: p.recent ?? [],
        };
      },
    },
  ),
);
