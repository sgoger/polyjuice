# /// script
# dependencies = ["pymupdf"]
# ///
# Contre-vérification indépendante (MuPDF) des PDF produits par run.ts : ouverture, aucune valeur
# d'origine dans le texte extrait ni dans les objets du fichier, tokens lisibles.
import json, re, sys, unicodedata
from pathlib import Path
import pymupdf

def pattern(v):
    v = unicodedata.normalize("NFKC", v).strip()
    body = r"\s*".join(re.escape(p) for p in v.split())
    return re.compile((r"(?<![\w])" if v[0].isalnum() else "") + body + (r"(?![\w])" if v[-1].isalnum() else ""))

ok = True
for values in sorted(Path(sys.argv[1]).glob("*.values.json")):
    name = values.name[: -len(".values.json")]
    reps = json.loads(values.read_text())
    for variant in ("B", "C"):
        pdf = values.with_name(f"{name}.{variant}.pdf")
        if not pdf.exists():
            continue
        doc = pymupdf.open(pdf)
        text = unicodedata.normalize("NFKC", "\n".join(p.get_text() for p in doc))
        raw = "\n".join(
            doc.xref_object(x) + "\n" + (doc.xref_stream(x) or b"").decode("latin1")
            for x in range(1, doc.xref_length())
            if not doc.xref_is_image(x) and not doc.xref_is_font(x)
        )
        left = sum(1 for r in reps if pattern(r["original"]).search(text))
        left_raw = sum(1 for r in reps if pattern(r["original"]).search(raw))
        tokens = sum(1 for r in reps if r["token"] in text)
        print(f"{name}.{variant}: {doc.page_count} p., valeurs restantes {left} (texte) / {left_raw} (objets), tokens lus {tokens}/{len(reps)}")
        ok &= left == 0 and left_raw == 0
sys.exit(0 if ok else 1)
