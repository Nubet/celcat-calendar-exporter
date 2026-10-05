export type ExportFormat = "ics" | "csv" | "json";

export type CelcatNameMap = Record<string, Record<string, {
  uniqueName: string;
  name: string | null;
  description: string | null;
}>>;

export interface CelcatRawEvent {
  eventId: string;
  dayOfWeek: number;
  startTime: number;
  duration: number;
  weeks: boolean[];
  modules: Array<{ type: number; id: string }>;
  staff: Array<{ type: number; id: string }>;
  facilities: Array<{ type: number; id: string }>;
  eventCategoryId: string;
  eventName: string | null;
  notes: string | null;
}

export interface CelcatEventsResponse {
  names: CelcatNameMap;
  events: CelcatRawEvent[];
  viewableResourceDates: Record<string, Array<{ startDate: number; endDate: number }>>;
}

export interface CalendarEvent {
  id: string;
  courseId: string;
  course: string;
  type: string;
  teacher: string;
  room: string;
  category: string;
  notes: string;
  start: Date;
  end: Date;
}

export interface ExportFilters {
  excludedEventIds: string[];
  excludedCourseIds: string[];
  excludedDays: number[];
}

export interface ExportRequest {
  resourceId: string;
  format: ExportFormat;
  timezone: string;
  filters: ExportFilters;
}
