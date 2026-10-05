import { describe, expect, it } from "vitest";
import { toCsv, toIcs, toJson } from "../src/domain/exporters";

const event = {
  id: "e-1", courseId: "c-1", course: "Data Analysis", type: "Lecture",
  teacher: "KUBIAK, Witold", room: "BUILDING A10 ROOM E2", category: "Lecture",
  notes: "week 1\nweek 2", start: new Date("2026-09-28T10:00:00"), end: new Date("2026-09-28T11:30:00"),
};

describe("exporters", () => {
  it("creates a valid iCalendar envelope and escapes text", () => {
    const result = toIcs([event]);
    expect(result).toContain("BEGIN:VCALENDAR\r\n");
    expect(result).toContain("SUMMARY:Data Analysis");
    expect(result).toContain("DESCRIPTION:Lecture\\nKUBIAK\\, Witold\\nweek 1\\nweek 2");
    expect(result).toContain("END:VCALENDAR\r\n");
  });

  it("creates CSV with a header and quoted values", () => {
    const result = toCsv([{ ...event, course: "Programowanie współbieżne", teacher: "ŁĄCKI, Żaneta" }]);
    expect(result.charCodeAt(0)).toBe(0xfeff);
    expect(result.split("\r\n")).toHaveLength(2);
    expect(result).toContain('"Programowanie współbieżne"');
    expect(result).toContain('"ŁĄCKI, Żaneta"');
  });

  it("creates readable JSON", () => {
    expect(JSON.parse(toJson([event]))).toEqual([{ ...event, start: event.start.toISOString(), end: event.end.toISOString() }]);
  });
});
