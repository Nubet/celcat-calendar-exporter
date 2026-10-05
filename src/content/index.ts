import { getBrowserTimezone, getSupportedTimezones } from "../domain/timezones";
import { downloadFile } from "../ui/download";

type Course = { id: string; name: string };
type DateRange = { start: string; end: string } | null;
type ExportSummary = { ok?: boolean; courses?: Course[]; dateRange?: DateRange; error?: string; count?: number };

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
let panelHost: HTMLElement | null = null;

function findResourceId(): string | null {
  const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  for (const entry of entries) {
    if (!entry.name.includes("/cal/resources/ids?")) continue;
    const id = new URL(entry.name).searchParams.get("1001");
    if (id) return id;
  }
  return null;
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if ((message as { type?: string }).type === "context") sendResponse({ resourceId: findResourceId() });
});

function closePanel(): void {
  panelHost?.remove();
  panelHost = null;
}

function openPanel(resourceId: string): void {
  if (panelHost) return;
  const browserTimezone = getBrowserTimezone();
  const timezoneOptions = getSupportedTimezones(browserTimezone)
    .map((timezone) => `<option value="${timezone}"${timezone === browserTimezone ? " selected" : ""}>${timezone}</option>`)
    .join("");

  panelHost = document.createElement("div");
  panelHost.id = "celcat-exporter-panel";
  const shadow = panelHost.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .backdrop { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; padding: 16px; background: rgb(15 23 42 / 42%); font: 14px/1.45 system-ui, sans-serif; color: #0f172a; }
      .panel { width: min(440px, 100%); max-height: min(680px, calc(100vh - 32px)); overflow: auto; padding: 20px; border-radius: 14px; background: #fff; box-shadow: 0 24px 80px rgb(15 23 42 / 28%); }
      .top { display: flex; align-items: start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
      h2 { margin: 0; font-size: 20px; letter-spacing: -.02em; }
      .subtle, .status { color: #64748b; font-size: 12px; }
      .subtle { margin: 4px 0 0; }
      .close { border: 0; border-radius: 8px; padding: 5px 9px; background: #f1f5f9; color: #475569; cursor: pointer; font-size: 18px; line-height: 1; }
      .group { margin-top: 14px; }
      label, .legend { display: block; margin-bottom: 6px; color: #334155; font-size: 12px; font-weight: 600; }
      select, input[type=date] { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 8px; padding: 9px 10px; background: #fff; color: #0f172a; font: inherit; }
      .dates { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .dates label { font-weight: 400; color: #64748b; }
      .courses { max-height: 150px; overflow: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px; }
      .course { display: flex; gap: 8px; align-items: center; padding: 7px; border-radius: 6px; cursor: pointer; }
      .course:hover { background: #f8fafc; }
      .course input { accent-color: #0f172a; }
      .section-head { display: flex; justify-content: space-between; align-items: center; }
      .text-button { border: 0; padding: 0; background: none; color: #64748b; cursor: pointer; font: inherit; font-size: 12px; }
      .days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
      .day { margin: 0; text-align: center; }
      .day input { position: absolute; opacity: 0; pointer-events: none; }
      .day span { display: block; padding: 6px 2px; border: 1px solid #e2e8f0; border-radius: 6px; color: #64748b; cursor: pointer; font-size: 11px; }
      .day input:checked + span { border-color: #0f172a; background: #0f172a; color: #fff; }
      .actions { display: flex; gap: 8px; margin-top: 20px; }
      .action { flex: 1; border: 0; border-radius: 8px; padding: 10px 12px; cursor: pointer; font: inherit; font-weight: 600; }
      .primary { background: #0f172a; color: #fff; }
      .secondary { background: #f1f5f9; color: #334155; }
      .status { min-height: 18px; margin: 10px 0 0; }
    </style>
    <div class="backdrop" role="presentation">
      <section class="panel" role="dialog" aria-modal="true" aria-labelledby="title">
        <div class="top"><div><h2 id="title">Export CELCAT</h2><p class="subtle">Choose what you want to download.</p></div><button class="close" type="button" aria-label="Close">&times;</button></div>
        <div class="group"><label for="format">Export format</label><select id="format"><option value="ics-by-category">One .ics per class type &mdash; .zip</option><option value="ics">All classes &mdash; one .ics file</option><option value="csv">CSV</option><option value="json">JSON</option></select></div>
        <div class="group"><label for="timezone">Time zone</label><select id="timezone">${timezoneOptions}</select></div>
        <div class="group"><span class="legend">Date range</span><div class="dates"><label>From<input id="start-date" type="date"></label><label>To<input id="end-date" type="date"></label></div></div>
        <div class="group"><div class="section-head"><span class="legend">Courses</span><button class="text-button" id="toggle" type="button">Deselect all</button></div><div class="courses" id="courses"></div></div>
        <div class="group"><span class="legend">Days to exclude</span><div class="days">${days.map((day, index) => `<label class="day"><input type="checkbox" data-day="${index + 1}"><span>${day}</span></label>`).join("")}</div></div>
        <div class="actions"><button class="action secondary" id="cancel" type="button">Cancel</button><button class="action primary" id="export" type="button">Export</button></div>
        <p class="status" id="status" role="status"></p>
      </section>
    </div>`;

  document.body.appendChild(panelHost);

  const root = shadow.querySelector<HTMLElement>(".backdrop")!;
  const status = shadow.querySelector<HTMLElement>("#status")!;
  const dateStart = shadow.querySelector<HTMLInputElement>("#start-date")!;
  const dateEnd = shadow.querySelector<HTMLInputElement>("#end-date")!;
  const courses = shadow.querySelector<HTMLElement>("#courses")!;
  const toggle = shadow.querySelector<HTMLButtonElement>("#toggle")!;

  shadow.querySelector<HTMLButtonElement>(".close")!.addEventListener("click", closePanel);
  shadow.querySelector<HTMLButtonElement>("#cancel")!.addEventListener("click", closePanel);
  root.addEventListener("click", (event) => { if (event.target === root) closePanel(); });
  const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closePanel(); };
  document.addEventListener("keydown", onEscape);
  status.textContent = "Loading courses...";

  chrome.runtime.sendMessage({ type: "load-events", resourceId }, (summary: ExportSummary) => {
    if (chrome.runtime.lastError || !summary?.ok) {
      status.textContent = summary?.error || "Could not load the schedule.";
      return;
    }
    if (summary.dateRange) {
      dateStart.value = summary.dateRange.start;
      dateEnd.value = summary.dateRange.end;
    }
    const availableCourses = summary.courses ?? [];
    for (const course of availableCourses) {
      const label = document.createElement("label");
      label.className = "course";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = true;
      input.dataset.course = course.id;
      const name = document.createElement("span");
      name.textContent = course.name;
      label.append(input, name);
      courses.append(label);
    }
    status.textContent = availableCourses.length ? "" : "No courses found in the current schedule.";
  });

  toggle.addEventListener("click", () => {
    const inputs = [...courses.querySelectorAll<HTMLInputElement>("[data-course]")];
    const check = inputs.some((input) => !input.checked);
    inputs.forEach((input) => { input.checked = check; });
    toggle.textContent = check ? "Deselect all" : "Select all";
  });

  shadow.querySelector<HTMLButtonElement>("#export")!.addEventListener("click", () => {
    if (!dateStart.value || !dateEnd.value || dateStart.value > dateEnd.value) {
      status.textContent = "Choose a valid date range.";
      return;
    }
    const excludedCourseIds = [...courses.querySelectorAll<HTMLInputElement>("[data-course]:not(:checked)")].map((input) => input.dataset.course!);
    const excludedDays = [...shadow.querySelectorAll<HTMLInputElement>("[data-day]:checked")].map((input) => Number(input.dataset.day));
    const format = shadow.querySelector<HTMLSelectElement>("#format")!.value;
    const timezone = shadow.querySelector<HTMLSelectElement>("#timezone")!.value;
    status.textContent = "Preparing download...";
    chrome.runtime.sendMessage({
      type: "export",
      export: { resourceId, format, timezone, filters: { excludedEventIds: [], excludedCourseIds, excludedDays, startDate: dateStart.value, endDate: dateEnd.value } },
    }, (response) => {
      if (response?.ok && response.file) {
        downloadFile(response.file);
        status.textContent = `Exported ${response.count} events.`;
      } else {
        status.textContent = response?.error || "Export failed.";
      }
    });
  });
}

function addButton(): void {
  if (document.getElementById("celcat-exporter-button")) return;
  const button = document.createElement("button");
  button.id = "celcat-exporter-button";
  button.type = "button";
  button.textContent = "Export CELCAT";
  button.addEventListener("click", () => {
    const resourceId = findResourceId();
    if (resourceId) openPanel(resourceId);
    else button.textContent = "Schedule not found";
  });
  document.body.appendChild(button);
}

export default function mount(): () => void {
  addButton();
  const observer = new MutationObserver(addButton);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => { observer.disconnect(); closePanel(); };
}
