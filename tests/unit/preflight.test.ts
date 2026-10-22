import { describe, expect, it } from "vitest";
import type { Inspection } from "../../src/adapters/inspect.ts";
import { preflightMessage } from "../../src/app/preflight.ts";

const base = (format: Inspection["format"], extra: Partial<Inspection>): Inspection => ({
  format,
  comments: 0,
  notes: 0,
  revisions: 0,
  trackRevisions: false,
  authors: 0,
  peopleList: false,
  ...extra,
});

describe("message au dépôt", () => {
  it("rien à signaler", () => {
    expect(preflightMessage(null)).toBeNull();
    expect(preflightMessage(base("docx", {}))).toBeNull();
  });

  it(".docx : commentaires et révisions, marche à suivre dans Word", () => {
    expect(preflightMessage(base("docx", { comments: 3, revisions: 12, authors: 2 }))).toEqual({
      title: "Ce document contient 3 commentaires et 12 révisions de 2 auteurs.",
      details: [
        "Les noms de ces auteurs resteront en clair dans le document anonymisé.",
        "Pour les retirer avant d'anonymiser : dans Word, onglet Révision → Accepter → Accepter toutes les modifications, puis Supprimer → Supprimer tous les commentaires du document ; enregistrez, puis déposez à nouveau le fichier.",
      ],
    });
  });

  it(".docx : un commentaire d'un auteur, liste de personnes et suivi activé", () => {
    const m = preflightMessage(base("docx", { comments: 1, authors: 1, peopleList: true, trackRevisions: true }));
    expect(m?.title).toBe("Ce document contient 1 commentaire d'un auteur.");
    expect(m?.details[0]).toBe("Le nom de cet auteur restera en clair dans le document anonymisé.");
    expect(m?.details[1]).toMatch(/onglet Révision → Supprimer → Supprimer tous les commentaires du document ;/);
    expect(m?.details[1]).not.toMatch(/Accepter/);
    expect(m?.details[2]).toMatch(/liste des personnes/);
    expect(m?.details[3]).toMatch(/^Le suivi des modifications est aussi activé : toute modification ultérieure/);
  });

  it(".docx : suivi des modifications seul", () => {
    expect(preflightMessage(base("docx", { trackRevisions: true }))).toEqual({
      title: "Le suivi des modifications est activé dans ce document.",
      details: [
        "Toute modification ultérieure serait enregistrée avec le nom de son auteur. Pour le désactiver : dans Word, onglet Révision → Suivi des modifications ; enregistrez, puis déposez à nouveau le fichier.",
      ],
    });
  });

  it(".docx : liste de personnes seule", () => {
    expect(preflightMessage(base("docx", { peopleList: true }))?.title).toMatch(/liste des personnes/);
  });

  it(".pptx : marche à suivre dans PowerPoint", () => {
    const m = preflightMessage(base("pptx", { comments: 2, authors: 2, peopleList: true }));
    expect(m?.title).toBe("Cette présentation contient 2 commentaires de 2 auteurs.");
    expect(m?.details.join(" ")).toMatch(/dans PowerPoint, onglet Révision → Supprimer/);
    expect(preflightMessage(base("pptx", { peopleList: true }))?.title).toMatch(/liste des auteurs/);
  });

  it(".xlsx : commentaires et notes, marche à suivre dans Excel", () => {
    const m = preflightMessage(base("xlsx", { comments: 1, notes: 2, authors: 3 }));
    expect(m?.title).toBe("Ce classeur contient 1 commentaire et 2 notes de 3 auteurs.");
    expect(m?.details).toContain("Le texte des commentaires et des notes n'est pas anonymisé non plus.");
    expect(m?.details.join(" ")).toMatch(/dans Excel, .*Effacer les commentaires et les notes/);
    expect(preflightMessage(base("xlsx", { notes: 1 }))?.details).toContain(
      "Le texte des notes n'est pas anonymisé non plus.",
    );
    expect(preflightMessage(base("xlsx", { peopleList: true }))?.title).toMatch(/liste des auteurs/);
  });
});
