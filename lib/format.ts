// Duration parsing/formatting + Jira timestamp helpers. Mirrors the CLI's logic.

/** "1h30m", "45m", "2h", "1.5h", "1d" -> seconds. Returns null if unparseable. */
export function parseDuration(input: string, hoursPerDay = 8): number | null {
  const s = String(input).trim().toLowerCase();
  if (!s) return null;
  let total = 0;
  let matched = false;
  const re = /(\d+(?:\.\d+)?)\s*([dhm])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    matched = true;
    const n = parseFloat(m[1]);
    if (m[2] === "d") total += n * hoursPerDay * 3600;
    else if (m[2] === "h") total += n * 3600;
    else if (m[2] === "m") total += n * 60;
  }
  if (!matched) return null;
  return Math.round(total);
}

/** seconds -> "1h 30m" (compact, human). */
export function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** seconds -> "01:30:45" (live stopwatch). */
export function fmtClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Date -> Jira worklog "started" format: 2026-06-01T10:00:00.000+0000 */
export function jiraTimestamp(date: Date): string {
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`
  );
}

/** Date -> "YYYY-MM-DD" in local time. */
export function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO -> value for an <input type="datetime-local"> (local time, no seconds). */
export function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value -> ISO. */
export function fromDateTimeLocal(value: string): string {
  return new Date(value).toISOString();
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Monday-based start of the week containing `d` (local midnight). */
export function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (r.getDay() + 6) % 7; // 0 = Monday
  r.setDate(r.getDate() - day);
  return r;
}

/** Relative day label for grouping entries. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (same(d, today)) return "Today";
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
