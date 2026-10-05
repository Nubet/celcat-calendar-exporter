const FALLBACK_TIMEZONE = "UTC";

export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE;
}

export function getSupportedTimezones(preferredTimezone = FALLBACK_TIMEZONE): string[] {
  const timezones = typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["Europe/Warsaw", "Europe/London", "America/New_York", "Asia/Tokyo"];

  return [...new Set([FALLBACK_TIMEZONE, preferredTimezone, ...timezones])].sort((a, b) => a.localeCompare(b));
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function resolveTimezone(timezone: string | undefined): string {
  return timezone && isValidTimezone(timezone) ? timezone : FALLBACK_TIMEZONE;
}
