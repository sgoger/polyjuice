# Ideas (out of scope for this version)

- Anonymize hyperlink targets (`mailto:`, personal URLs) in OOXML relationships and in Markdown, consistently with the link text.
- Anonymize Word field codes (`w:instrText`).
- Process the text of charts and SmartArt.
- Recognize variants of a names glossary entry (surname alone, « M. Rivière », « Thomas R. »), grouped under the same token. Risk: many surnames are also common nouns (« Rivière », « Boulanger », « Weber »), so a surname alone would create false positives; it would need to be opt-in per entry or restricted to capitalized occurrences near a full match.
- One-click cleanup at drop time: accept or reject tracked changes, remove comments, notes and `word/people.xml`, switch off track changes, before anonymizing (today the user does it in Office, guided by the drop-time banner).
- Anonymize comment and revision author names (`w:author`, `ppt/commentAuthors.xml`, `ppt/authors.xml`, `xl/persons/`) consistently with the names in the text, and process the text of PowerPoint and Excel comments.
