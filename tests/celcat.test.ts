import { describe, expect, it } from "vitest";
import { normalizeEvents } from "../src/domain/celcat";
import type { CelcatEventsResponse } from "../src/domain/models";

const response: CelcatEventsResponse = {
  names: {
    "1000": { "1": { uniqueName: "Course", name: "Course", description: null } },
    "1002": { "2": { uniqueName: "Teacher", name: "Teacher", description: null } },
    "1003": { "3": { uniqueName: "Room", name: "Room", description: null } },
    "1105": { "23": { uniqueName: "Lecture", name: "Lecture", description: null } },
  },
  events: [{
    eventId: "event", dayOfWeek: 1, startTime: 3_600_000, duration: 90, weeks: [true, false, true],
    modules: [{ type: 1000, id: "1" }], staff: [{ type: 1002, id: "2" }], facilities: [{ type: 1003, id: "3" }],
    eventCategoryId: "23", eventName: null, notes: null,
  }],
  viewableResourceDates: { resource: [{ startDate: Date.UTC(2026, 8, 28), endDate: Date.UTC(2026, 9, 19) }] },
};

describe("CELCAT normalization", () => {
  it("expands active weeks into separate occurrences", () => {
    const events = normalizeEvents(response, "resource");
    expect(events).toHaveLength(2);
    expect(events[0].course).toBe("Course");
    expect(events[0].room).toBe("Room");
  });

  it("filters courses and days before export", () => {
    expect(normalizeEvents(response, "resource", { excludedCourseIds: ["1"], excludedEventIds: [], excludedDays: [] })).toHaveLength(0);
    expect(normalizeEvents(response, "resource", { excludedCourseIds: [], excludedEventIds: [], excludedDays: [1] })).toHaveLength(0);
  });
});
