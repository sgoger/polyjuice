import { describe, expect, it } from "vitest";

describe("environnement de test", () => {
  it("expose WebCrypto", () => {
    expect(typeof globalThis.crypto.subtle.digest).toBe("function");
  });
});
