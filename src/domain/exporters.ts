import type { CalendarEvent, ExportFormat } from "./models";
import { resolveTimezone } from "./timezones";

const CRLF = "\r\n";
const escapeText = (value: string | null | undefined) => String(value ?? "").replace(/[\\;,\n]/g, (character) => character === "\n" ? "\\n" : `\\${character}`);
const pad = (value: number) => String(value).padStart(2, "0");
export interface ExportedFile { content: string; mime: string; extension: string; filename: string; }

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

function hash(value: string): number {
  return [...value].reduce((result, character) => ((result * 31) + character.charCodeAt(0)) | 0, 0) >>> 0;
}

function hslToHex(hue: number, saturation = 65, lightness = 55): string {
  const chroma = (1 - Math.abs((2 * lightness / 100) - 1)) * saturation / 100;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const match = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  const adjustment = lightness / 100 - chroma / 2;
  return `#${match.map((channel) => Math.round((channel + adjustment) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function colorForEvent(event: CalendarEvent): string {
  if (typeof event.color === "string" && /^#[0-9a-f]{6}$/i.test(event.color)) return event.color;
  if (typeof event.color === "number") return hslToHex((event.color * 137.508) % 360);
  return hslToHex(hash(event.category) % 360);
}

function colorForEvents(events: CalendarEvent[]): string {
  return colorForEvent(events[0]);
}

function safeFilename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "category";
}

export function toIcs(events: CalendarEvent[], timezone = "UTC", calendarName = "CELCAT", calendarColor?: string): string {
  const resolvedTimezone = resolveTimezone(timezone);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CELCAT Calendar Exporter//EN", "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(calendarName)}`, `X-WR-TIMEZONE:${escapeText(resolvedTimezone)}`,
  ];
  if (calendarColor) lines.push(`COLOR:${calendarColor}`, `X-APPLE-CALENDAR-COLOR:${calendarColor}`);
  for (const event of events) {
    const eventColor = colorForEvent(event);
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
      `COLOR:${eventColor}`,
      ...(event.color === null ? [] : [`X-CELCAT-COLOR-ID:${escapeText(String(event.color))}`]),
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

export function exportFiles(events: CalendarEvent[], format: ExportFormat, timezone = "UTC"): ExportedFile[] {
  if (format === "csv") return [{ content: toCsv(events), mime: "text/csv", extension: "csv", filename: "celcat-export.csv" }];
  if (format === "json") return [{ content: toJson(events), mime: "application/json", extension: "json", filename: "celcat-export.json" }];
  if (format === "ics") return [{ content: toIcs(events, timezone), mime: "text/calendar", extension: "ics", filename: "celcat-export.ics" }];

  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) groups.set(event.category, [...(groups.get(event.category) ?? []), event]);
  return [...groups.entries()].map(([category, categoryEvents]) => ({
    content: toIcs(categoryEvents, timezone, `CELCAT - ${category}`, colorForEvents(categoryEvents)),
    mime: "text/calendar",
    extension: "ics",
    filename: `celcat-${safeFilename(category)}.ics`,
  }));
}
