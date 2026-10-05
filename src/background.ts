import { zipSync } from "fflate";
import { exportFiles } from "./domain/exporters";
import { listCourses, normalizeEvents } from "./domain/celcat";
import type { CelcatEventsResponse, ExportRequest } from "./domain/models";

const ORIGIN = "https://lodz.celcat.cloud";

async function getEvents(resourceId: string): Promise<CelcatEventsResponse> {
  const response = await fetch(`${ORIGIN}/cal/events?${encodeURIComponent(resourceId)}=1001`);
  if (!response.ok) throw new Error(`CELCAT returned ${response.status}`);
  return response.json() as Promise<CelcatEventsResponse>;
}

function downloadText(content: string, mime: string, filename: string): Promise<number> {
  const url = `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
  return chrome.downloads.download({ url, filename, saveAs: true });
}

function downloadZip(files: ReturnType<typeof exportFiles>): Promise<number> {
  const archive = zipSync(Object.fromEntries(files.map((file) => [file.filename, new TextEncoder().encode(file.content)])));
  let binary = "";
  for (const byte of archive) binary += String.fromCharCode(byte);
  const url = `data:application/zip;base64,${btoa(binary)}`;
  return chrome.downloads.download({ url, filename: "celcat-export-by-category.zip", saveAs: true });
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const request = message as { type?: string; resourceId?: string; export?: ExportRequest };
  if (request.type === "load-events" && request.resourceId) {
    const resourceId = request.resourceId;
    getEvents(resourceId)
      .then((data) => {
        const events = normalizeEvents(data, resourceId);
        const dates = events.map((event) => event.start.toISOString().slice(0, 10));
        sendResponse({
          ok: true,
          courses: listCourses(data),
          eventCount: data.events.length,
          dateRange: dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null,
        });
      })
      .catch((error: unknown) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (request.type === "export" && request.export) {
    const exportRequest = request.export;
    getEvents(exportRequest.resourceId)
      .then((data) => {
        const events = normalizeEvents(data, exportRequest.resourceId, exportRequest.filters);
        const files = exportFiles(events, exportRequest.format, exportRequest.timezone || "UTC");
        const downloadPromise = exportRequest.format === "ics-by-category"
          ? downloadZip(files)
          : downloadText(files[0].content, files[0].mime, files[0].filename);
        return downloadPromise.then(() => ({ count: events.length }));
      })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error: unknown) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  return false;
});
