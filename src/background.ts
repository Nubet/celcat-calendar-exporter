import { exportFile } from "./domain/exporters";
import { listCourses, normalizeEvents } from "./domain/celcat";
import type { CelcatEventsResponse, ExportRequest } from "./domain/models";

const ORIGIN = "https://lodz.celcat.cloud";

async function getEvents(resourceId: string): Promise<CelcatEventsResponse> {
  const response = await fetch(`${ORIGIN}/cal/events?${encodeURIComponent(resourceId)}=1001`);
  if (!response.ok) throw new Error(`CELCAT returned ${response.status}`);
  return response.json() as Promise<CelcatEventsResponse>;
}

function download(content: string, mime: string, extension: string): Promise<number> {
  const url = `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
  return chrome.downloads.download({ url, filename: `celcat-export.${extension}`, saveAs: true });
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const request = message as { type?: string; resourceId?: string; export?: ExportRequest };
  if (request.type === "load-events" && request.resourceId) {
    getEvents(request.resourceId)
      .then((data) => sendResponse({ ok: true, courses: listCourses(data), eventCount: data.events.length }))
      .catch((error: unknown) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (request.type === "export" && request.export) {
    const exportRequest = request.export;
    getEvents(exportRequest.resourceId)
      .then((data) => {
        const events = normalizeEvents(data, exportRequest.resourceId, exportRequest.filters);
        const file = exportFile(events, exportRequest.format, exportRequest.timezone || "UTC");
        return download(file.content, file.mime, file.extension).then(() => ({ count: events.length }));
      })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error: unknown) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  return false;
});
