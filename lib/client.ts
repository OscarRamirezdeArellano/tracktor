// Client-side API wrapper. Auth travels via the httpOnly cookie set by /api/auth,
// so the token is never held in client JS.
import type { ConnectionStatus, Credentials, Entry, JiraIssue, Me, RemoteWorklog } from "./types";
import { jiraTimestamp } from "./format";

async function unwrap<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message || `Request failed (${res.status})`);
  return data as T;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

// ---- auth ----
export async function getAuthStatus(): Promise<ConnectionStatus> {
  return unwrap<ConnectionStatus>(await fetch("/api/auth"));
}

export async function saveCredentials(c: Credentials): Promise<{ displayName: string; avatarUrl?: string }> {
  return unwrap(await fetch("/api/auth", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(c) }));
}

export async function disconnect(): Promise<void> {
  await fetch("/api/auth", { method: "DELETE" });
}

// ---- jira ----
export async function fetchMe(): Promise<Me> {
  return unwrap<Me>(await fetch("/api/jira/me"));
}

export async function fetchIssues(): Promise<JiraIssue[]> {
  return (await unwrap<{ issues: JiraIssue[] }>(await fetch("/api/jira/issues"))).issues;
}

export async function searchIssues(q: string): Promise<JiraIssue[]> {
  return (await unwrap<{ issues: JiraIssue[] }>(await fetch(`/api/jira/search?q=${encodeURIComponent(q)}`))).issues;
}

export async function fetchWorklogs(from: string, to: string): Promise<RemoteWorklog[]> {
  return (await unwrap<{ worklogs: RemoteWorklog[] }>(await fetch(`/api/jira/worklogs?from=${from}&to=${to}`))).worklogs;
}

export async function pushWorklog(entry: Entry, newRemaining?: string): Promise<string | null> {
  const data = await unwrap<{ id: string | null }>(
    await fetch("/api/jira/worklog", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        issueKey: entry.issueKey,
        timeSpentSeconds: entry.seconds,
        started: jiraTimestamp(new Date(entry.started)),
        comment: entry.comment || undefined,
        newRemaining: newRemaining || undefined,
      }),
    }),
  );
  return data.id;
}

export async function editWorklog(entry: Entry): Promise<void> {
  if (!entry.jiraWorklogId) return;
  await unwrap(
    await fetch("/api/jira/worklog", {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        issueKey: entry.issueKey,
        worklogId: entry.jiraWorklogId,
        timeSpentSeconds: entry.seconds,
        started: jiraTimestamp(new Date(entry.started)),
        comment: entry.comment || undefined,
      }),
    }),
  );
}

export async function deleteWorklog(issueKey: string, worklogId: string): Promise<void> {
  await unwrap(
    await fetch("/api/jira/worklog", {
      method: "DELETE",
      headers: JSON_HEADERS,
      body: JSON.stringify({ issueKey, worklogId }),
    }),
  );
}
