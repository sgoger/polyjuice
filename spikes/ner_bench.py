# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = [
#   "spacy==3.8.16",
#   "fr_core_news_md @ https://github.com/explosion/spacy-models/releases/download/fr_core_news_md-3.8.0/fr_core_news_md-3.8.0-py3-none-any.whl",
#   "de_core_news_md @ https://github.com/explosion/spacy-models/releases/download/de_core_news_md-3.8.0/de_core_news_md-3.8.0-py3-none-any.whl",
#   "en_core_web_md @ https://github.com/explosion/spacy-models/releases/download/en_core_web_md-3.8.0/en_core_web_md-3.8.0-py3-none-any.whl",
# ]
# ///
"""Spike 0.2 — quality and speed of spaCy ``md`` NER models (FR/DE/EN).

Usage:
    uv run spikes/ner_bench.py

For each language: model load time, analysis time of a ~2,000-word text, and
the PERSON/ORG/LOC entities found on 10 annotated fictitious sentences, with
false negatives (expected but missed or mistyped) and false positives.
"""

from __future__ import annotations

import platform
import time
from dataclasses import dataclass

import spacy

MODELS = {"fr": "fr_core_news_md", "de": "de_core_news_md", "en": "en_core_web_md"}

# spaCy labels -> Presidio-like types retained by polyjuice.
LABELS = {
    "PER": "PERSON",
    "PERSON": "PERSON",
    "ORG": "ORG",
    "LOC": "LOC",
    "GPE": "LOC",
}


@dataclass(frozen=True)
class Sample:
    text: str
    expected: tuple[tuple[str, str], ...]  # (surface, type)


SAMPLES: dict[str, list[Sample]] = {
    "fr": [
        Sample(
            "Paulina Kowalski a rejoint l'équipe de Lyon en septembre.",
            (("Paulina Kowalski", "PERSON"), ("Lyon", "LOC")),
        ),
        Sample(
            "Le dossier a été transmis à Mehmet Yılmaz par la société Durand Logistique.",
            (("Mehmet Yılmaz", "PERSON"), ("Durand Logistique", "ORG")),
        ),
        Sample(
            "Jean-Baptiste Lefèvre et Agnieszka Wiśniewska se retrouveront à Strasbourg.",
            (
                ("Jean-Baptiste Lefèvre", "PERSON"),
                ("Agnieszka Wiśniewska", "PERSON"),
                ("Strasbourg", "LOC"),
            ),
        ),
        Sample(
            "Merci à Camille pour sa relecture attentive.",
            (("Camille", "PERSON"),),
        ),
        Sample(
            "Selon Martin, la réunion avec la Banque Populaire est reportée.",
            (("Martin", "PERSON"), ("Banque Populaire", "ORG")),
        ),
        Sample(
            "Ayşe Demir travaille désormais chez Arte France à Issy-les-Moulineaux.",
            (
                ("Ayşe Demir", "PERSON"),
                ("Arte France", "ORG"),
                ("Issy-les-Moulineaux", "LOC"),
            ),
        ),
        Sample(
            "Le rapport de Mme Rose Petit a été validé par le conseil d'administration.",
            (("Rose Petit", "PERSON"),),
        ),
        Sample(
            "Nous avons appelé Grzegorz Brzęczyszczykiewicz au sujet de la facture.",
            (("Grzegorz Brzęczyszczykiewicz", "PERSON"),),
        ),
        Sample(
            "Le stagiaire, Lucas, part pour Marseille demain avec Emre Kaya.",
            (("Lucas", "PERSON"), ("Marseille", "LOC"), ("Emre Kaya", "PERSON")),
        ),
        Sample(
            "La Fondation Lumière a financé le projet de Claire Fontaine.",
            (("Fondation Lumière", "ORG"), ("Claire Fontaine", "PERSON")),
        ),
    ],
    "de": [
        Sample(
            "Paulina Kowalski hat gestern den Vertrag in Hamburg unterschrieben.",
            (("Paulina Kowalski", "PERSON"), ("Hamburg", "LOC")),
        ),
        Sample(
            "Die Besprechung mit Mehmet Öztürk von der Firma Schneider Bau fand in Köln statt.",
            (
                ("Mehmet Öztürk", "PERSON"),
                ("Schneider Bau", "ORG"),
                ("Köln", "LOC"),
            ),
        ),
        Sample(
            "Der Bericht über die Sicherheit der Anlage wurde von Klaus Becker geprüft.",
            (("Klaus Becker", "PERSON"),),
        ),
        Sample(
            "Danke an Jonas für die schnelle Antwort.",
            (("Jonas", "PERSON"),),
        ),
        Sample(
            "Die Abteilung Verwaltung und der Vorstand haben die Planung genehmigt.",
            (),
        ),
        Sample(
            "Katarzyna Nowak und Hans Müller arbeiten jetzt bei der Deutschen Bahn.",
            (
                ("Katarzyna Nowak", "PERSON"),
                ("Hans Müller", "PERSON"),
                ("Deutschen Bahn", "ORG"),
            ),
        ),
        Sample(
            "Frau Elif Şahin übernimmt ab Montag die Leitung in München.",
            (("Elif Şahin", "PERSON"), ("München", "LOC")),
        ),
        Sample(
            "Die Mitarbeiter haben Wolf und Fischer gestern im Büro getroffen.",
            (("Wolf", "PERSON"), ("Fischer", "PERSON")),
        ),
        Sample(
            "Laut Sabine ist die Lieferung aus Leipzig noch nicht angekommen.",
            (("Sabine", "PERSON"), ("Leipzig", "LOC")),
        ),
        Sample(
            "Der Verein Grüne Zukunft e.V. hat Tomasz Zieliński eingeladen.",
            (("Grüne Zukunft e.V.", "ORG"), ("Tomasz Zieliński", "PERSON")),
        ),
    ],
    "en": [
        Sample(
            "Paulina Kowalski joined the London office in September.",
            (("Paulina Kowalski", "PERSON"), ("London", "LOC")),
        ),
        Sample(
            "The file was sent to Mehmet Yilmaz by Harbor Freight Partners.",
            (("Mehmet Yilmaz", "PERSON"), ("Harbor Freight Partners", "ORG")),
        ),
        Sample(
            "Thanks to Emily for reviewing the draft.",
            (("Emily", "PERSON"),),
        ),
        Sample(
            "Mark will Bill the client once the Rose Garden project is complete.",
            (("Mark", "PERSON"),),
        ),
        Sample(
            "Zbigniew Wójcik and Fatma Arslan met the board of Northwind Ltd in Manchester.",
            (
                ("Zbigniew Wójcik", "PERSON"),
                ("Fatma Arslan", "PERSON"),
                ("Northwind Ltd", "ORG"),
                ("Manchester", "LOC"),
            ),
        ),
        Sample(
            "According to Dr. Hannah Clarke, the results are preliminary.",
            (("Hannah Clarke", "PERSON"),),
        ),
        Sample(
            "Please forward the invoice to Burak at the Berlin branch.",
            (("Burak", "PERSON"), ("Berlin", "LOC")),
        ),
        Sample(
            "The Green Valley Foundation awarded a grant to Oliver Grant.",
            (("Green Valley Foundation", "ORG"), ("Oliver Grant", "PERSON")),
        ),
        Sample(
            "Jean Dupont from Lyon presented the budget to the committee.",
            (("Jean Dupont", "PERSON"), ("Lyon", "LOC")),
        ),
        Sample(
            "Our contact at Acme Corp, Sarah, will call Piotr Kamiński tomorrow.",
            (
                ("Acme Corp", "ORG"),
                ("Sarah", "PERSON"),
                ("Piotr Kamiński", "PERSON"),
            ),
        ),
    ],
}


def long_text(lang: str, words: int = 2000) -> str:
    """~``words`` words built by cycling the samples (enough to time the pipeline)."""
    sentences = [s.text for s in SAMPLES[lang]]
    out: list[str] = []
    count = 0
    i = 0
    while count < words:
        sentence = sentences[i % len(sentences)]
        out.append(sentence)
        count += len(sentence.split())
        i += 1
    return " ".join(out)


def main() -> None:
    print(
        f"spaCy {spacy.__version__}, Python {platform.python_version()}, {platform.machine()}"
    )
    print()
    print("| Lang | Model | Load (s) | Words | Analysis (s) | Words/s |")
    print("|---|---|---|---|---|---|")
    nlps = {}
    for lang, model in MODELS.items():
        t0 = time.perf_counter()
        nlp = spacy.load(model)
        load = time.perf_counter() - t0
        nlps[lang] = nlp
        text = long_text(lang)
        n_words = len(text.split())
        nlp("warm-up")
        t0 = time.perf_counter()
        nlp(text)
        analysis = time.perf_counter() - t0
        print(
            f"| {lang} | {model} | {load:.2f} | {n_words} | {analysis:.3f} | {n_words / analysis:,.0f} |"
        )

    totals = {"tp": 0, "fn": 0, "fp": 0}
    for lang, samples in SAMPLES.items():
        print(f"\n## {lang}\n")
        for sample in samples:
            doc = nlps[lang](sample.text)
            found = {(e.text, LABELS[e.label_]) for e in doc.ents if e.label_ in LABELS}
            others = [(e.text, e.label_) for e in doc.ents if e.label_ not in LABELS]
            expected = set(sample.expected)
            tp = expected & found
            fn = expected - found
            fp = found - expected
            totals["tp"] += len(tp)
            totals["fn"] += len(fn)
            totals["fp"] += len(fp)
            print(f"- {sample.text}")
            print(f"  - found: {sorted(found) or '—'}")
            if others:
                print(f"  - other labels (ignored): {others}")
            if fn:
                print(f"  - FALSE NEGATIVES: {sorted(fn)}")
            if fp:
                print(f"  - false positives: {sorted(fp)}")

    print(f"\nTotals (exact surface + type): {totals}")


if __name__ == "__main__":
    main()
