import type { CalendarEvent } from "./models";

const CRLF = "\r\n";
const escapeText = (value: string) => value.replace(/[\\;,\n]/g, (character) => character === "\n" ? "\\n" : `\\${character}`);
const pad = (value: number) => String(value).padStart(2, "0");

function localDate(value: Date): string {
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}T${pad(value.getHours())}${pad(value.getMinutes())}00`;
}

export function toIcs(events: CalendarEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CELCAT Calendar Exporter//EN", "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:CELCAT", "X-WR-TIMEZONE:Europe/Warsaw",
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(event.id)}`,
      `DTSTAMP:${localDate(new Date())}`,
      `DTSTART;TZID=Europe/Warsaw:${localDate(event.start)}`,
      `DTEND;TZID=Europe/Warsaw:${localDate(event.end)}`,
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

export function exportFile(events: CalendarEvent[], format: "ics" | "csv" | "json"): { content: string; mime: string; extension: string } {
  if (format === "csv") return { content: toCsv(events), mime: "text/csv", extension: "csv" };
  if (format === "json") return { content: toJson(events), mime: "application/json", extension: "json" };
  return { content: toIcs(events), mime: "text/calendar", extension: "ics" };
}
