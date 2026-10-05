import { describe, expect, it } from "vitest";
import { getSupportedTimezones, isValidTimezone, resolveTimezone } from "../src/domain/timezones";

describe("timezones", () => {
  it("accepts IANA time zones supported by the runtime", () => {
    expect(isValidTimezone("Europe/Warsaw")).toBe(true);
    expect(isValidTimezone("Asia/Tokyo")).toBe(true);
    expect(isValidTimezone("not/a-timezone")).toBe(false);
  });

  it("includes the preferred zone and UTC in the picker", () => {
    const timezones = getSupportedTimezones("Asia/Tokyo");
    expect(timezones).toContain("Asia/Tokyo");
    expect(timezones).toContain("UTC");
  });

  it("falls back safely for invalid input", () => {
    expect(resolveTimezone("invalid/timezone")).toBe("UTC");
  });
});
