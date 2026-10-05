function findResourceId(): string | null {
  const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  for (const entry of entries) {
    if (!entry.name.includes("/cal/resources/ids?")) continue;
    const query = new URL(entry.name).searchParams;
    const id = query.get("1001");
    if (id) return id;
  }
  return null;
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if ((message as { type?: string }).type === "context") {
    sendResponse({ resourceId: findResourceId() });
  }
});

function addButton(): void {
  if (document.getElementById("celcat-exporter-button")) return;
  const button = document.createElement("button");
  button.id = "celcat-exporter-button";
  button.type = "button";
  button.textContent = "Export CELCAT";
  button.addEventListener("click", () => {
    const resourceId = findResourceId();
    if (!resourceId) {
      button.textContent = "Schedule not found";
      return;
    }
    button.disabled = true;
    chrome.runtime.sendMessage({
      type: "export",
      export: { resourceId, format: "ics", filters: { excludedEventIds: [], excludedCourseIds: [], excludedDays: [] } },
    }, (response) => {
      button.disabled = false;
      button.textContent = response?.ok ? `Exported ${response.count} events` : "Export error";
    });
  });
  document.body.appendChild(button);
}

export default function mount(): () => void {
  addButton();
  const observer = new MutationObserver(addButton);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => observer.disconnect();
}
