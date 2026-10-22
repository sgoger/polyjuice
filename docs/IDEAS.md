# Ideas (out of scope for this version)

- Anonymize hyperlink targets (`mailto:`, personal URLs) in OOXML relationships and in Markdown, consistently with the link text.
- Anonymize Word field codes (`w:instrText`) and the author names of comments and revisions.
- Process the text of charts and SmartArt.
- Recognize variants of a names glossary entry (surname alone, « M. Rivière », « Thomas R. »), grouped under the same token. Risk: many surnames are also common nouns (« Rivière », « Boulanger », « Weber »), so a surname alone would create false positives; it would need to be opt-in per entry or restricted to capitalized occurrences near a full match.
