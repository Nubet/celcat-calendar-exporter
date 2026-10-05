import type { CalendarEvent, CelcatEventsResponse, CelcatRawEvent, ExportFilters } from "./models";

const COURSE = 1000;
const STUDENT_SET = 1001;
const STAFF = 1002;
const FACILITY = 1003;
const ACTIVITY_CATEGORY = 1105;

function lookup(response: CelcatEventsResponse, type: number, id: string): string {
  return response.names[String(type)]?.[id]?.name?.trim() || response.names[String(type)]?.[id]?.uniqueName?.trim() || "";
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function occurrenceDate(weekStart: number, weekIndex: number, dayOfWeek: number, startTime: number): Date {
  return new Date(weekStart + weekIndex * 7 * 86_400_000 + (dayOfWeek - 1) * 86_400_000 + startTime);
}

function courseId(event: CelcatRawEvent): string {
  return event.modules.find((module) => module.type === COURSE)?.id || "unknown";
}

export function normalizeEvents(response: CelcatEventsResponse, resourceId: string, filters?: ExportFilters): CalendarEvent[] {
  const range = response.viewableResourceDates[resourceId]?.[0];
  if (!range) return [];

  const excludedEvents = new Set(filters?.excludedEventIds ?? []);
  const excludedCourses = new Set(filters?.excludedCourseIds ?? []);
  const excludedDays = new Set(filters?.excludedDays ?? []);
  const result: CalendarEvent[] = [];

  for (const event of response.events) {
    const id = event.eventId;
    const currentCourseId = courseId(event);
    if (excludedEvents.has(id) || excludedCourses.has(currentCourseId)) continue;

    for (let weekIndex = 0; weekIndex < event.weeks.length; weekIndex += 1) {
      if (!event.weeks[weekIndex] || excludedDays.has(event.dayOfWeek)) continue;
      const start = occurrenceDate(range.startDate, weekIndex, event.dayOfWeek, event.startTime);
      result.push({
        id: `${id}-${start.toISOString()}`,
        courseId: currentCourseId,
        course: lookup(response, COURSE, currentCourseId) || "Untitled course",
        type: lookup(response, ACTIVITY_CATEGORY, event.eventCategoryId) || event.eventCategoryId,
        teacher: event.staff.map((item) => lookup(response, STAFF, item.id)).filter(Boolean).join(", "),
        room: event.facilities.map((item) => lookup(response, FACILITY, item.id)).filter(Boolean).join(", "),
        category: lookup(response, ACTIVITY_CATEGORY, event.eventCategoryId) || event.eventCategoryId,
        notes: [event.eventName, event.notes].filter(Boolean).join("\n"),
        start,
        end: addMinutes(start, event.duration),
      });
    }
  }

  return result.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function listCourses(response: CelcatEventsResponse): Array<{ id: string; name: string }> {
  return Object.entries(response.names[String(COURSE)] ?? {})
    .map(([id, value]) => ({ id, name: value.name?.trim() || value.uniqueName.trim() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
