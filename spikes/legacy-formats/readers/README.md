# Office 97-2003 readers (spike only)

Prototype readers measured by the legacy-formats spike: compound file (`cfb.ts`), Excel BIFF8 (`biff.ts`) with conversion to `.xlsx` (`xls.ts`), Word text (`word.ts`), PowerPoint text (`powerpoint.ts`). They worked on every test file but were **not shipped**: the formats are rare and users can convert them in one step, so polyjuice refuses them with a conversion message instead. Results and decision: [`docs/DEVIATIONS.md`](../../../docs/DEVIATIONS.md#legacy-office-formats-doc-xls-ppt-and-neighbours).
