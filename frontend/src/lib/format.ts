// Plain, friendly formatters — no compact (1.2K) for non-technical users.
// Show full numbers with thousand separators. Hide the engineer-y stuff.

const numberFmt = new Intl.NumberFormat("en-US");
const pctFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const relativeFmt = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

export function num(value: number): string {
  return numberFmt.format(Math.round(value));
}

export function pct(fraction: number): string {
  return pctFmt.format(fraction);
}

export function signed(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${numberFmt.format(rounded)}`;
  return numberFmt.format(rounded);
}

export function shortDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function dateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

export function relative(iso: string, now: Date = new Date()): string {
  const ms = new Date(iso).getTime() - now.getTime();
  const minutes = Math.round(ms / 60_000);
  if (Math.abs(minutes) < 60) return relativeFmt.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeFmt.format(hours, "hour");
  const days = Math.round(hours / 24);
  return relativeFmt.format(days, "day");
}

export function durationMin(startIso: string, stopIso: string | null): string {
  const start = new Date(startIso).getTime();
  const end = stopIso ? new Date(stopIso).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - start) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours} hr` : `${hours} hr ${rem} min`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
