# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Spike 0.1 — check which tokens survived translation.

Usage:
    uv run spikes/token_survival_check.py <translated file> [--expected PATH]

Accepts ``.docx``, ``.md`` or ``.txt``. For each expected token, lists the
occurrences found intact, found deformed (permissive match: other brackets,
spaces, dash variants, lowercase...) and missing. Also lists any other
``⟦…⟧`` sequence found. Exit code 0 when every expected occurrence is intact.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
DOCX_TEXT_PARTS = re.compile(
    r"^word/(document|footnotes|endnotes|comments|header\d*|footer\d*)\.xml$"
)
DASHES = r"[-‐‑‒–—―_]"
STRICT_ANY = re.compile(r"⟦[^⟦⟧\n]{1,20}⟧")
CONTEXT = 15


def docx_text(path: Path) -> str:
    """Paragraph texts of every text part, runs concatenated."""
    paragraphs: list[str] = []
    with zipfile.ZipFile(path) as zf:
        for name in sorted(zf.namelist()):
            if not DOCX_TEXT_PARTS.match(name):
                continue
            root = ET.fromstring(zf.read(name))
            for p in root.iter(f"{W_NS}p"):
                paragraphs.append("".join(t.text or "" for t in p.iter(f"{W_NS}t")))
    return "\n".join(paragraphs)


def load_text(path: Path) -> str:
    if path.suffix.lower() == ".docx":
        return docx_text(path)
    if path.suffix.lower() in {".md", ".txt"}:
        return path.read_text(encoding="utf-8")
    sys.exit(f"Unsupported extension: {path.suffix}")


def permissive_pattern(token: str) -> re.Pattern[str]:
    """Match the token core (letter + 5 chars) with optional brackets, spaces,
    dash variants and any case."""
    core = token.strip("⟦⟧")
    letter, chars = core.split("-")
    body = r"\s*".join(re.escape(c) for c in chars)
    return re.compile(
        rf"\S?\s*{re.escape(letter)}\s*{DASHES}?\s*{body}\s*\S?", re.IGNORECASE
    )


def snippet(text: str, start: int, end: int) -> str:
    left = text[max(0, start - CONTEXT) : start]
    right = text[end : end + CONTEXT]
    return f"…{left}[[{text[start:end]}]]{right}…".replace("\n", " ⏎ ")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("translated", type=Path)
    parser.add_argument(
        "--expected",
        type=Path,
        default=Path(__file__).parent / "out" / "token_survival.expected.json",
    )
    args = parser.parse_args()

    expected: dict[str, int] = json.loads(args.expected.read_text(encoding="utf-8"))
    text = load_text(args.translated)

    all_ok = True
    total_expected = total_intact = 0
    seen_spans: list[tuple[int, int]] = []
    for token, n_expected in expected.items():
        intact = [m.span() for m in re.finditer(re.escape(token), text)]
        seen_spans += intact
        deformed = [
            m
            for m in permissive_pattern(token).finditer(text)
            if not any(s <= m.start() + 1 and m.end() - 1 <= e for s, e in intact)
            and m.group(0).strip() != token
        ]
        seen_spans += [m.span() for m in deformed]
        missing = max(0, n_expected - len(intact) - len(deformed))
        total_expected += n_expected
        total_intact += min(len(intact), n_expected)
        ok = len(intact) == n_expected and not deformed
        all_ok &= ok
        print(
            f"{'OK ' if ok else 'KO '} {token}: expected {n_expected}, "
            f"intact {len(intact)}, deformed {len(deformed)}, missing {missing}"
        )
        for m in deformed:
            print(f"      deformed: {snippet(text, m.start(), m.end())}")

    others = [
        m
        for m in STRICT_ANY.finditer(text)
        if not any(s < m.end() and m.start() < e for s, e in seen_spans)
    ]
    if others:
        all_ok = False
        print("Other ⟦…⟧ sequences found:")
        for m in others:
            print(f"      {snippet(text, m.start(), m.end())}")

    rate = 100 * total_intact / total_expected if total_expected else 100.0
    print(f"\nIntact: {total_intact}/{total_expected} ({rate:.1f} %)")
    print("ACCEPTED" if all_ok else "NOT ACCEPTED: see deformations above")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
