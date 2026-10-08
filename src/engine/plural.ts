/** Accord en nombre à la française (0 et 1 au singulier) : `n` suivi du nom accordé. */
export const pl = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;

/** Choisit la forme accordée sans préfixer le nombre. */
export const agree = (n: number, one: string, many: string): string => (n > 1 ? many : one);
