import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FIXTURES = join(import.meta.dirname, "../fixtures");

describe("fixtures", () => {
  it("sont reproductibles et à jour", () => {
    const out = mkdtempSync(join(tmpdir(), "polyjuice-fixtures-"));
    execFileSync("npx", ["tsx", "scripts/make-fixtures.ts"], {
      env: { ...process.env, FIXTURES_OUT: out, TZ: "UTC" },
      stdio: "ignore",
    });
    const files = readdirSync(out).sort();
    expect(files).toEqual(readdirSync(FIXTURES).sort());
    for (const f of files) {
      expect(readFileSync(join(out, f)).equals(readFileSync(join(FIXTURES, f))), f).toBe(true);
    }
  }, 60_000);
});
