export interface DownloadPayload {
  content?: string;
  base64?: string;
  mime: string;
  filename: string;
}

export function downloadFile(file: DownloadPayload): void {
  const data = file.base64 ? Uint8Array.from(atob(file.base64), (character) => character.charCodeAt(0)) : file.content ?? "";
  const blob = new Blob([data], { type: file.mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
