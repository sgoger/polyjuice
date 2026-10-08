import { describe, expect, it } from "vitest";
import { formatDuration } from "../../src/app/components/Timer.tsx";

describe("formatDuration", () => {
  it("secondes, puis minutes et secondes sur deux chiffres", () => {
    expect(formatDuration(0)).toBe("0 s");
    expect(formatDuration(42_900)).toBe("42 s");
    expect(formatDuration(60_000)).toBe("1 min 00 s");
    expect(formatDuration(190_400)).toBe("3 min 10 s");
  });
});
