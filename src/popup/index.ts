import type { ExportFormat } from "../domain/models";
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app")!;
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function render(message: string): void { app.innerHTML = `<div class="empty-state"><p class="muted">${message}</p></div>`; }

async function init(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) return render("Open the CELCAT calendar.");
  chrome.tabs.sendMessage(tab.id, { type: "context" }, (context) => {
    const resourceId = context?.resourceId as string | null;
    if (!resourceId) return render("No active CELCAT schedule found.");
    chrome.runtime.sendMessage({ type: "load-events", resourceId }, (summary) => {
      if (!summary?.ok) return render(summary?.error || "Failed to fetch the schedule.");
      renderForm(resourceId, summary.courses);
    });
  });
}

function renderForm(resourceId: string, courses: Array<{ id: string; name: string }>): void {
  app.innerHTML = `
    <header class="header">
      <div class="header-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
      <h1 class="header-title">CELCAT Exporter</h1>
    </header>
    
    <div class="field-group">
      <label class="field-label" for="format">Export Format</label>
      <select id="format" class="select-input"><option value="ics">iCalendar (.ics)</option><option value="csv">CSV</option><option value="json">JSON</option></select>
    </div>
    
    <div class="section-head">
      <span>Courses</span>
      <button id="toggle" type="button" class="btn-text">Deselect all</button>
    </div>
    <div class="courses-list">
      ${courses.map((course) => `<label class="check-item"><input type="checkbox" class="checkbox" data-course="${course.id}" checked><span class="check-label">${course.name}</span></label>`).join("")}
    </div>
    
    <div class="section-head">
      <span>Days to exclude</span>
    </div>
    <div class="days-list">
      ${days.map((day, index) => `<label class="day-item"><input type="checkbox" data-day="${index + 1}"><span class="day-label">${day}</span></label>`).join("")}
    </div>
    
    <div class="footer">
      <button class="btn-primary" id="export" type="button">Export Schedule</button>
      <p id="status" class="status-msg"></p>
    </div>`;
  
  const toggle = document.querySelector<HTMLButtonElement>("#toggle")!;
  toggle.addEventListener("click", () => {
    const inputs = [...document.querySelectorAll<HTMLInputElement>("[data-course]")];
    const shouldCheck = inputs.some((input) => !input.checked);
    inputs.forEach((input) => { input.checked = shouldCheck; });
    toggle.textContent = shouldCheck ? "Deselect all" : "Select all";
  });
  
  document.querySelector<HTMLButtonElement>("#export")!.addEventListener("click", () => {
    const excludedCourseIds = [...document.querySelectorAll<HTMLInputElement>("[data-course]:not(:checked)")].map((input) => input.dataset.course!);
    const excludedDays = [...document.querySelectorAll<HTMLInputElement>("[data-day]:checked")].map((input) => Number(input.dataset.day));
    const format = document.querySelector<HTMLSelectElement>("#format")!.value as ExportFormat;
    
    chrome.runtime.sendMessage({ type: "export", export: { resourceId, format, filters: { excludedEventIds: [], excludedCourseIds, excludedDays } } }, (response) => {
      document.querySelector("#status")!.textContent = response?.ok ? `Exported ${response.count} events.` : (response?.error || "Export failed.");
    });
  });
}

void init();
