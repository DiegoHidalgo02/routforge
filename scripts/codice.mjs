// Il testo del codice per le regole del repository (architettura, tracciabilità): senza commenti, così un import o un
// titolo di test commentato non conta. Sta fuori dai file `.test.mjs`: importato da lì, ne registrerebbe i test.
export const senzaCommenti = (codice) => codice.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
