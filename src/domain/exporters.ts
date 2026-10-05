import type { CalendarEvent } from "./models";
import { resolveTimezone } from "./timezones";

const CRLF = "\r\n";
const escapeText = (value: string) => value.replace(/[\\;,\n]/g, (character) => character === "\n" ? "\\n" : `\\${character}`);
const pad = (value: number) => String(value).padStart(2, "0");

function zonedDate(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(value).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}00`;
}

function utcDate(value: Date): string {
  return `${value.getUTCFullYear()}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}T${pad(value.getUTCHours())}${pad(value.getUTCMinutes())}${pad(value.getUTCSeconds())}Z`;
}

export function toIcs(events: CalendarEvent[], timezone = "UTC"): string {
  const resolvedTimezone = resolveTimezone(timezone);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CELCAT Calendar Exporter//EN", "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:CELCAT", `X-WR-TIMEZONE:${escapeText(resolvedTimezone)}`,
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(event.id)}`,
      `DTSTAMP:${utcDate(new Date())}`,
      `DTSTART;TZID=${escapeText(resolvedTimezone)}:${zonedDate(event.start, resolvedTimezone)}`,
      `DTEND;TZID=${escapeText(resolvedTimezone)}:${zonedDate(event.end, resolvedTimezone)}`,
      `SUMMARY:${escapeText(event.course)}`,
      `DESCRIPTION:${[event.type, event.teacher, event.notes].filter(Boolean).map(escapeText).join("\\n")}`,
      `LOCATION:${escapeText(event.room)}`,
      `CATEGORIES:${escapeText(event.category)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.join(CRLF)}${CRLF}`;
}

export function toCsv(events: CalendarEvent[]): string {
  const columns = ["start", "end", "course", "type", "teacher", "room", "notes"];
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const rows = [columns.join(","), ...events.map((event) => [event.start.toISOString(), event.end.toISOString(), event.course, event.type, event.teacher, event.room, event.notes].map(quote).join(","))];
  return `\uFEFF${rows.join("\r\n")}`;
}

export function toJson(events: CalendarEvent[]): string {
  return JSON.stringify(events, null, 2);
}

export function exportFile(events: CalendarEvent[], format: "ics" | "csv" | "json", timezone = "UTC"): { content: string; mime: string; extension: string } {
  if (format === "csv") return { content: toCsv(events), mime: "text/csv", extension: "csv" };
  if (format === "json") return { content: toJson(events), mime: "application/json", extension: "json" };
  return { content: toIcs(events, timezone), mime: "text/calendar", extension: "ics" };
}
