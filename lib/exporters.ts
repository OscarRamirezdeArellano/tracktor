"use client";
import type { Entry } from "./types";
import { fmtDuration } from "./format";

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function exportCsv(entries: Entry[]) {
  const header = ["Issue", "Date", "Started", "Duration", "Seconds", "Comment", "Synced", "WorklogId"];
  const rows = entries.map((e) => {
    const d = new Date(e.started);
    return [
      e.issueKey,
      d.toLocaleDateString(),
      d.toLocaleString(),
      fmtDuration(e.seconds),
      String(e.seconds),
      e.comment ?? "",
      e.synced ? "yes" : "no",
      e.jiraWorklogId ?? "",
    ]
      .map(csvCell)
      .join(",");
  });
  download(`time-log-${new Date().toISOString().slice(0, 10)}.csv`, [header.join(","), ...rows].join("\n"), "text/csv");
}

export function exportJson(entries: Entry[]) {
  download(
    `time-log-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), entries }, null, 2),
    "application/json",
  );
}

export function parseImport(text: string): Entry[] {
  const data = JSON.parse(text);
  const arr: unknown[] = Array.isArray(data) ? data : data?.entries;
  if (!Array.isArray(arr)) throw new Error("File doesn't contain an entries array.");
  return arr.map((raw, i) => {
    const e = raw as Partial<Entry>;
    if (!e.issueKey || typeof e.seconds !== "number" || !e.started) {
      throw new Error(`Entry ${i + 1} is missing issueKey, seconds or started.`);
    }
    return {
      id: e.id || Math.random().toString(36).slice(2, 10),
      issueKey: e.issueKey.toUpperCase(),
      summary: e.summary,
      seconds: e.seconds,
      started: e.started,
      comment: e.comment ?? "",
      synced: Boolean(e.synced),
      jiraWorklogId: e.jiraWorklogId ?? null,
      syncError: null,
    };
  });
}
