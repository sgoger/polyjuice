import { describe, expect, it } from "vitest";
import { GLOSSARY_KEY, glossaryStore } from "../../src/app/glossary.ts";

/** Storage factice en mémoire ; `fail` simule un stockage bloqué ou plein. */
class FakeStorage implements Storage {
  private items = new Map<string, string>();
  constructor(private fail: { get?: boolean; set?: boolean; remove?: boolean } = {}) {}
  get length() {
    return this.items.size;
  }
  key(i: number) {
    return [...this.items.keys()][i] ?? null;
  }
  getItem(k: string) {
    if (this.fail.get) throw new DOMException("bloqué", "SecurityError");
    return this.items.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.fail.set) throw new DOMException("plein", "QuotaExceededError");
    this.items.set(k, v);
  }
  removeItem(k: string) {
    if (this.fail.remove) throw new DOMException("bloqué", "SecurityError");
    this.items.delete(k);
  }
  clear() {
    this.items.clear();
  }
}

describe("glossaryStore", () => {
  it("lit, écrit et supprime une seule clé, en texte brut", () => {
    const storage = new FakeStorage();
    const store = glossaryStore(() => storage);
    expect(store.available).toBe(true);
    expect(store.load()).toBeNull();
    expect(storage.length).toBe(0);

    expect(store.save("# Équipe\nThomas Rivière\n")).toBe(true);
    expect(storage.length).toBe(1);
    expect(storage.getItem(GLOSSARY_KEY)).toBe("# Équipe\nThomas Rivière\n");
    expect(glossaryStore(() => storage).load()).toBe("# Équipe\nThomas Rivière\n");

    store.clear();
    expect(store.load()).toBeNull();
    expect(storage.length).toBe(0);
  });

  it("la vérification d'accès ne touche pas à une copie existante", () => {
    const storage = new FakeStorage();
    storage.setItem(GLOSSARY_KEY, "Jean Dupont");
    const store = glossaryStore(() => storage);
    expect(store.load()).toBe("Jean Dupont");
    expect(storage.length).toBe(1);
  });

  it("stockage inaccessible : indisponible, sans exception", () => {
    for (const getStorage of [
      () => {
        throw new DOMException("bloqué", "SecurityError");
      },
      () => new FakeStorage({ set: true }),
    ]) {
      const store = glossaryStore(getStorage);
      expect(store.available).toBe(false);
      expect(store.load()).toBeNull();
      expect(store.save("Thomas Rivière")).toBe(false);
      expect(() => {
        store.clear();
      }).not.toThrow();
    }
  });

  it("échecs de lecture, d'écriture ou de suppression après coup : sans exception", () => {
    const fail: { get?: boolean; set?: boolean; remove?: boolean } = {};
    const storage = new FakeStorage(fail);
    const store = glossaryStore(() => storage);
    expect(store.available).toBe(true);
    fail.get = fail.set = fail.remove = true;
    expect(store.load()).toBeNull();
    expect(store.save("Thomas Rivière")).toBe(false);
    expect(() => {
      store.clear();
    }).not.toThrow();
  });
});
