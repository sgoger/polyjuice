// Restauration stricte : chaque token connu du mapping est remplacé par sa valeur d'origine.
import type { Mapping } from "./mapping.ts";
import { tokenRegex } from "./tokens.ts";
import type { Edit } from "./types.ts";
import { applyEdits } from "./replace.ts";

export interface RestoreInventory {
  /** Token du mapping → nombre d'occurrences restaurées. */
  found: Map<string, number>;
  /** Token au format valide absent du mapping → nombre d'occurrences (laissées telles quelles). */
  unknown: Map<string, number>;
}

export const emptyInventory = (): RestoreInventory => ({ found: new Map(), unknown: new Map() });

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

export function restoreText(
  text: string,
  entities: Mapping["entities"],
  inventory: RestoreInventory,
): { text: string; edits: Edit[] } {
  const edits: Edit[] = [];
  for (const m of text.matchAll(tokenRegex())) {
    const entity = Object.hasOwn(entities, m[0]) ? entities[m[0]] : undefined;
    if (entity) {
      edits.push({ start: m.index, end: m.index + m[0].length, replacement: entity.original });
      bump(inventory.found, m[0]);
    } else {
      bump(inventory.unknown, m[0]);
    }
  }
  return { text: applyEdits(text, edits), edits };
}

/** Tokens du mapping absents du document (information). */
export function missingTokens(entities: Mapping["entities"], inventory: RestoreInventory): string[] {
  return Object.keys(entities)
    .filter((t) => !inventory.found.has(t))
    .sort();
}
