/**
 * @jest-environment node
 */
import { toMoroccoTime } from "../index";

describe("toMoroccoTime", () => {
  it("keeps Aladhan's Moroccan clock time", () => {
    // Casablanca Fajr, 23 Oct 2026, as returned by api.aladhan.com with iso8601=true
    expect(toMoroccoTime("2026-10-23T05:13:00+00:00")).toBe("05:13");
    expect(toMoroccoTime("2025-01-02T07:01:00+01:00")).toBe("07:01");
  });
});
