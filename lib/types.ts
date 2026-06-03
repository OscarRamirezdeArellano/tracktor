// Shared types for the Jira time tracker.

export type Theme = "dark" | "light";

/** Local app preferences (stored in the browser). Credentials live server-side now. */
export interface AppSettings {
  hoursPerDay: number;
  dailyGoalHours: number;
  weeklyGoalHours: number;
  theme: Theme;
}

/** Credentials entered in Settings and posted to /api/auth (kept in an httpOnly cookie). */
export interface Credentials {
  baseUrl: string;
  email: string;
  apiToken: string;
}

/** What /api/auth GET reports back (never includes the token). */
export interface ConnectionStatus {
  configured: boolean;
  baseUrl?: string;
  email?: string;
  source?: "cookie" | "env";
}

export interface Me {
  displayName: string;
  emailAddress?: string;
  accountId: string;
  avatarUrl?: string;
}

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  statusCategory: "new" | "indeterminate" | "done" | string;
  priority?: string;
  duedate?: string | null;
}

/** A locally-tracked time entry. Lives in the browser until pushed to Jira via sync. */
export interface Entry {
  id: string;
  issueKey: string;
  summary?: string;
  seconds: number;
  started: string; // ISO timestamp of when the work happened
  comment: string;
  synced: boolean;
  jiraWorklogId?: string | null;
  syncError?: string | null;
}

/** A worklog read back from Jira (already logged — possibly via Clockwork or the Jira UI). */
export interface RemoteWorklog {
  id: string;
  issueKey: string;
  summary?: string;
  seconds: number;
  started: string; // ISO
  comment?: string;
}

/** The single active stopwatch, if any. */
export interface Timer {
  issueKey: string;
  summary?: string;
  comment: string;
  startedAt: string; // ISO
}
