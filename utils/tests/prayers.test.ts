/**
 * @jest-environment node
 */
import { toMoroccoTime } from "../index";

describe("toMoroccoTime", () => {
  it("shows Aladhan's UTC instants on Morocco's UTC+1 clock", () => {
    // Casablanca Fajr, 23 Oct 2026: Aladhan says 05:13 UTC, the Moroccan clock reads 06:13
    expect(toMoroccoTime("2026-10-23T05:13:00+00:00")).toBe("06:13");
  });

  it("follows Morocco back to UTC+0 during Ramadan", () => {
    // Clocks went back on 23 Feb 2025 for Ramadan
    expect(toMoroccoTime("2025-02-22T06:00:00+00:00")).toBe("07:00");
    expect(toMoroccoTime("2025-02-24T06:00:00+00:00")).toBe("06:00");
  });
});
