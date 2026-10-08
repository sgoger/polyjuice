import { describe, expect, it } from "vitest";
import { detectCommon, ibanChecksumOk, isIPv6, luhnOk } from "../../src/engine/detectors/regexCommon.ts";
import { detectFr, nirKeyOk } from "../../src/engine/detectors/regexFr.ts";
import type { EntityType } from "../../src/engine/types.ts";

const all = (text: string) => [...detectCommon(text), ...detectFr(text)];
const found = (text: string, type: EntityType) =>
  all(text)
    .filter((d) => d.type === type)
    .map((d) => d.text);

describe("e-mail", () => {
  it.each([
    ["Écrire à p.kowalski@example.org.", "p.kowalski@example.org"],
    ["<jean.dupont+test@sous.example.fr>", "jean.dupont+test@sous.example.fr"],
    ["mailto:zoë.müller@exämple.de, merci", "zoë.müller@exämple.de"],
  ])("%s", (text, want) => {
    expect(found(text, "EMAIL_ADDRESS")).toEqual([want]);
  });
  it.each(["a@b", "@example.org", "user@localhost", "nom @ example.org"])("rejette %s", (text) => {
    expect(found(text, "EMAIL_ADDRESS")).toEqual([]);
  });
});

describe("URL", () => {
  it.each([
    ["Voir https://intranet.example.fr/profil/jdupont.", "https://intranet.example.fr/profil/jdupont"],
    ["(lien : www.example.org/a?b=c)", "www.example.org/a?b=c"],
    ["https://fr.wikipedia.org/wiki/Paris_(France), etc.", "https://fr.wikipedia.org/wiki/Paris_(France)"],
    ["[texte](https://example.org/x)", "https://example.org/x"],
  ])("%s", (text, want) => {
    expect(found(text, "URL")).toEqual([want]);
  });
  it("ne détecte pas un simple domaine", () => {
    expect(found("example.org", "URL")).toEqual([]);
  });
});

describe("IP", () => {
  it.each([
    ["poste 192.168.12.34.", "192.168.12.34"],
    ["serveur 10.0.0.1:8080", "10.0.0.1"],
    ["2001:db8::8a2e:370:7334", "2001:db8::8a2e:370:7334"],
    ["fe80:0:0:0:200:f8ff:fe21:67cf", "fe80:0:0:0:200:f8ff:fe21:67cf"],
  ])("%s", (text, want) => {
    expect(found(text, "IP_ADDRESS")).toEqual([want]);
  });
  it.each(["256.1.1.1", "1.2.3", "réunion à 10:30:45", "1.2.3.4.5", "std::vector"])("rejette %s", (text) => {
    expect(found(text, "IP_ADDRESS")).toEqual([]);
  });
  it("IPv6 avec IPv4 embarquée (le chevauchement est résolu par detect)", () => {
    expect(found("::ffff:192.0.2.128 ok", "IP_ADDRESS")).toContain("::ffff:192.0.2.128");
  });
  it("valide IPv6", () => {
    expect(isIPv6("::1")).toBe(true);
    expect(isIPv6("10:30")).toBe(false);
    expect(isIPv6("::")).toBe(false);
  });
});

describe("IBAN", () => {
  it.each([
    ["IBAN FR76 3000 6000 0112 3456 7890 189 merci", "FR76 3000 6000 0112 3456 7890 189"],
    ["DE89370400440532013000", "DE89370400440532013000"],
    ["GB82 WEST 1234 5698 7654 32", "GB82 WEST 1234 5698 7654 32"],
    ["FR76 3000 6000 0112 3456 7890 189 ET AUTRE", "FR76 3000 6000 0112 3456 7890 189"],
  ])("%s", (text, want) => {
    expect(found(text, "IBAN_CODE")).toEqual([want]);
  });
  it("rejette un IBAN dont la clé est fausse", () => {
    expect(found("FR76 3000 6000 0112 3456 7890 188", "IBAN_CODE")).toEqual([]);
    expect(ibanChecksumOk("FR7630006000011234567890189")).toBe(true);
    expect(ibanChecksumOk("FR7730006000011234567890189")).toBe(false);
  });
});

describe("carte bancaire", () => {
  it.each([
    ["carte 4111 1111 1111 1111.", "4111 1111 1111 1111"],
    ["5555-5555-5555-4444", "5555-5555-5555-4444"],
    ["Amex 378282246310005", "378282246310005"],
    ["Amex 3782 822463 10005", "3782 822463 10005"],
  ])("%s", (text, want) => {
    expect(found(text, "CREDIT_CARD")).toEqual([want]);
  });
  it("rejette un groupement qui n'est pas celui d'une carte", () => {
    expect(found("+49 30 12345678 06 12 34 56 78", "CREDIT_CARD")).toEqual([]);
  });
  it("rejette un numéro qui échoue à Luhn", () => {
    expect(found("4111 1111 1111 1112", "CREDIT_CARD")).toEqual([]);
    expect(luhnOk("4111111111111111")).toBe(true);
  });
});

describe("téléphone", () => {
  it.each([
    ["Tél. 06 12 34 56 78.", "06 12 34 56 78"],
    ["01.23.45.67.89", "01.23.45.67.89"],
    ["0612345678", "0612345678"],
    ["+33 1 23 45 67 89", "+33 1 23 45 67 89"],
    ["+33612345678", "+33612345678"],
    ["0033 6 98 76 54 32", "0033 6 98 76 54 32"],
    ["+49 30 12345678", "+49 30 12345678"],
    ["+49 (0)30 1234567", "+49 (0)30 1234567"],
    ["+44 20 7946 0958", "+44 20 7946 0958"],
    ["0044 20 7946 0958", "0044 20 7946 0958"],
  ])("%s", (text, want) => {
    expect(found(text, "PHONE_NUMBER")).toEqual([want]);
  });
  it.each(["le 12/03/2026", "année 2026", "06 12 34 56", "+33 12"])("rejette %s", (text) => {
    expect(found(text, "PHONE_NUMBER")).toEqual([]);
  });
});

describe("NIR", () => {
  // 1 85 05 78 006 084 + clé 91 (97 − 1850578006084 mod 97)
  it.each([
    ["NIR 1 85 05 78 006 084 91.", "1 85 05 78 006 084 91"],
    ["185057800608491", "185057800608491"],
    ["2 69 05 2A 123 456 88", "2 69 05 2A 123 456 88"],
  ])("%s", (text, want) => {
    expect(found(text, "FR_NIR")).toEqual([want]);
  });
  it("15 chiffres sans clé valide ne sont pas un NIR", () => {
    expect(found("185057800608492", "FR_NIR")).toEqual([]);
    expect(nirKeyOk("1 85 05 78 006 084 91")).toBe(true);
  });
});

describe("tokens existants", () => {
  it("aucune détection à l'intérieur d'un token", () => {
    expect(all("⟦T-2345A⟧ ⟦A-22222⟧ ⟦N-23456⟧ ⟦E-ABCDE⟧")).toEqual([]);
  });
  it("les détections voisines d'un token restent", () => {
    expect(found("⟦P-ABCDE⟧ jean@example.org", "EMAIL_ADDRESS")).toEqual(["jean@example.org"]);
  });
});
