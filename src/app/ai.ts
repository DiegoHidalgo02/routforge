/**
 * L'assistente AI (MECCANISMI §18; FUNZIONALITÀ §16; T-026; D-AI-1). La chiave dell'utente sta nella riga
 * `preferenze.chiaveAi` (`CHIAVE_AI`: mai in backup né sync, D-BACKUP-1, D-SYNC-3) e passa solo alla porta `AiClient`
 * (INV-17). Una conversazione nasce col primo messaggio e tiene il suo ambito; il contesto si legge dai dati del corso
 * e dai materiali con testo (§17: il PDF scansionato no, H2), la risposta arriva in streaming ed è interrompibile.
 * Offline il messaggio resta `in_attesa` e parte da solo al ritorno della rete. Nessuna eccezione arriva alla UI: gli
 * errori sono quelli di §18 (`aiError`), il resto va in Diagnostica (INV-16).
 */
import type { RoutForgeDb } from '../data/db';
import { get, inTransaction, list, listBy, remove, save } from '../data/repository';
import {
  aiError,
  chatContext,
  chatTurns,
  generationInstruction,
  systemInstruction,
  type AmbitoAperto,
  type ContestoChat,
  type ErroreAi,
  type FonteMateriale,
  type FonteUnita,
} from '../domain/ai';
import { isGroundable, type Materiale } from '../domain/materials';
import type { ModelloAi } from '../domain/settings';
import { CHIAVE_AI } from './backup';
import { logError } from './diagnostics';
import type { AiClient } from './ports/ai';
import type { Rete } from './ports/network';
import { readSettings } from './settings';

let client: AiClient | null = null;
/** Il modello AI della piattaforma, dal punto di composizione. */
export const configureAi = (c: AiClient): void => {
  client = c;
};

const MODELLI: Record<ModelloAi, string> = { flash: 'gemini-2.5-flash', pro: 'gemini-2.5-pro' };
/** Il nome inglese della lingua delle risposte per il prompt (MECC §18), da `Intl` invece che scritto a mano (audit P3-22). */
const NOME_INGLESE = new Intl.DisplayNames(['en'], { type: 'language' });

const erroreDi = (e: unknown): ErroreAi =>
  aiError((e as { status?: number | null } | null)?.status ?? null, e instanceof Error ? e.message : String(e));

/** La chiave intera resta in questo modulo e va solo alla porta (INV-17): la UI vede la versione coperta. */
async function readAiKey(db: RoutForgeDb): Promise<string | null> {
  const v = (await get(db, 'preferenze', CHIAVE_AI))?.valore;
  return typeof v === 'string' && v ? v : null;
}

/** La chiave per S22 e per sapere se c'è: «AIza••••…7Qk», o `null` senza chiave. */
export async function readMaskedAiKey(db: RoutForgeDb): Promise<string | null> {
  const k = await readAiKey(db);
  return k && `${k.slice(0, 4)}${'•'.repeat(20)}${k.slice(-3)}`;
}

/** «Verifica» di S22: la chiave si salva, solo su questo dispositivo, se il servizio l'accetta. */
export async function saveAiKey(db: RoutForgeDb, chiave: string, now: number): Promise<ErroreAi | null> {
  const k = chiave.trim();
  // Un carattere invisibile incollato farebbe fallire la richiesta come se mancasse la rete
  if (!/^[\x21-\x7E]+$/.test(k)) return 'chiave';
  if (!client) return 'generico';
  try {
    await client.verify(k);
  } catch (e) {
    return erroreDi(e);
  }
  try {
    await save(db, 'preferenze', { id: CHIAVE_AI, valore: k }, now);
    return null;
  } catch (e) {
    logError('ai', e);
    return 'generico';
  }
}

export const removeAiKey = (db: RoutForgeDb, now: number): Promise<void> =>
  remove(db, 'preferenze', CHIAVE_AI, now).catch((e: unknown) => logError('ai', e));

/** La chat dell'unità (S12 «Chiedi all'AI», la sessione); `null` se l'unità non c'è più. */
export async function unitScope(db: RoutForgeDb, unitaId: string): Promise<AmbitoAperto | null> {
  const u = await get(db, 'unita', unitaId);
  return u ? { ambito: 'unita', corsoId: u.corsoId, moduloId: u.moduloId, unitaId: u.id } : null;
}

/** La chat del modulo (S11 «Chiedi all'AI»). */
export async function moduleScope(db: RoutForgeDb, moduloId: string): Promise<AmbitoAperto | null> {
  const m = await get(db, 'moduli', moduloId);
  return m ? { ambito: 'modulo', corsoId: m.corsoId, moduloId: m.id, unitaId: null } : null;
}

/** Come si chiama l'ambito in S19 e nell'elenco: corso, numero del modulo e dell'unità; ciò che non c'è più è globale. */
export type NomeAmbito =
  | { ambito: 'globale' }
  | { ambito: 'corso'; corso: string }
  | { ambito: 'modulo'; corso: string; modulo: number }
  | { ambito: 'unita'; corso: string; unita: string };

export async function scopeName(db: RoutForgeDb, a: AmbitoAperto): Promise<NomeAmbito> {
  const corso = a.ambito !== 'globale' && a.corsoId ? await get(db, 'corsi', a.corsoId) : undefined;
  if (!corso) return { ambito: 'globale' };
  if (a.ambito === 'modulo') {
    const m = a.moduloId ? await get(db, 'moduli', a.moduloId) : undefined;
    return m ? { ambito: 'modulo', corso: corso.titolo, modulo: m.numero } : { ambito: 'globale' };
  }
  if (a.ambito === 'unita') {
    const u = a.unitaId ? await get(db, 'unita', a.unitaId) : undefined;
    return u ? { ambito: 'unita', corso: corso.titolo, unita: u.numero } : { ambito: 'globale' };
  }
  return { ambito: 'corso', corso: corso.titolo };
}

/** Una conversazione con i messaggi in ordine (S19); `undefined` se non c'è più. */
export async function readChat(db: RoutForgeDb, conversazioneId: string) {
  const conversazione = await get(db, 'conversazioni', conversazioneId);
  if (!conversazione) return undefined;
  const messaggi = (await listBy(db, 'messaggi', 'conversazioneId', conversazioneId)).sort(
    (a, b) => a.istante - b.istante,
  );
  return { conversazione, messaggi, nome: await scopeName(db, conversazione) };
}

/** L'elenco delle conversazioni (§18): dalla più recente, con l'ambito per nome e il numero di messaggi. */
export async function readConversations(db: RoutForgeDb) {
  const conversazioni = (await list(db, 'conversazioni')).sort((a, b) => b.ultimoMessaggio - a.ultimoMessaggio);
  return Promise.all(
    conversazioni.map(async (c) => ({
      id: c.id,
      titolo: c.titolo,
      ultimoMessaggio: c.ultimoMessaggio,
      messaggi: (await listBy(db, 'messaggi', 'conversazioneId', c.id)).length,
      nome: await scopeName(db, c),
    })),
  );
}

async function fonteUnita(db: RoutForgeDb, u: { id: string; numero: string; titolo: string; markdown: string }) {
  const sezioni = (await listBy(db, 'sezioni', 'unitaId', u.id)).sort((a, b) => a.ordine - b.ordine);
  const risorse = (
    await Promise.all(
      sezioni.map(async (s) => (await listBy(db, 'risorse', 'sezioneId', s.id)).sort((a, b) => a.ordine - b.ordine)),
    )
  ).flat();
  return {
    numero: u.numero,
    titolo: u.titolo,
    markdown: u.markdown,
    risorse: risorse.map((r) => ({ titolo: r.titolo, url: r.url })),
  } satisfies FonteUnita;
}

const fonteMateriale = (m: Materiale): FonteMateriale =>
  m.tipo === 'link'
    ? { tipo: 'link', titolo: m.titolo, url: m.url ?? '' }
    : { tipo: m.tipo, titolo: m.titolo, testo: (m.tipo === 'nota' ? m.testo : m.testoEstratto) ?? '' };

/** Il contesto dell'ambito dai dati (§18); un corso, modulo o unità che non c'è più vale come chat globale. */
async function contextOf(db: RoutForgeDb, a: AmbitoAperto): Promise<ContestoChat> {
  const corso = a.ambito !== 'globale' && a.corsoId ? await get(db, 'corsi', a.corsoId) : undefined;
  if (!corso) return { ambito: 'globale' };
  const materiali = (await list(db, 'materiali')).filter((m) => m.corsoId === corso.id && isGroundable(m));
  const di = (f: (m: Materiale) => boolean) => materiali.filter(f).map(fonteMateriale);
  if (a.ambito === 'unita') {
    const u = a.unitaId ? await get(db, 'unita', a.unitaId) : undefined;
    const m = u ? await get(db, 'moduli', u.moduloId) : undefined;
    if (!u || !m) return { ambito: 'globale' };
    const codice = (await listBy(db, 'fileCodice', 'unitaId', u.id)).flatMap((f) =>
      f.contenuto ? [{ percorso: f.percorso, contenuto: f.contenuto }] : [],
    );
    return {
      ambito: 'unita',
      corso: corso.titolo,
      modulo: { numero: m.numero, titolo: m.titolo },
      unita: await fonteUnita(db, u),
      codice,
      materiali: di((x) => x.unitaId === u.id),
    };
  }
  if (a.ambito === 'modulo') {
    const m = a.moduloId ? await get(db, 'moduli', a.moduloId) : undefined;
    if (!m) return { ambito: 'globale' };
    const unita = (await listBy(db, 'unita', 'moduloId', m.id)).sort((x, y) => x.ordine - y.ordine);
    const ids = new Set(unita.map((u) => u.id));
    // Anche il codice delle unità: è la fonte primaria (T-025); quello rimasto senza unità non entra in nessun contesto
    const codice = (await Promise.all(unita.map((u) => listBy(db, 'fileCodice', 'unitaId', u.id))))
      .flat()
      .flatMap((f) => (f.contenuto ? [{ percorso: f.percorso, contenuto: f.contenuto }] : []));
    return {
      ambito: 'modulo',
      corso: corso.titolo,
      modulo: { numero: m.numero, titolo: m.titolo },
      unita: await Promise.all(unita.map((u) => fonteUnita(db, u))),
      codice,
      materiali: di((x) => x.unitaId !== null && ids.has(x.unitaId)),
    };
  }
  const moduli = (await listBy(db, 'moduli', 'corsoId', corso.id)).sort((x, y) => x.numero - y.numero);
  const unita = (await listBy(db, 'unita', 'corsoId', corso.id)).sort((x, y) => x.ordine - y.ordine);
  return {
    ambito: 'corso',
    corso: corso.titolo,
    moduli: moduli.map((m) => ({
      numero: m.numero,
      titolo: m.titolo,
      unita: unita
        .filter((u) => u.moduloId === m.id)
        .map((u) => ({ numero: u.numero, titolo: u.titolo, concettoCore: u.concettoCore?.titolo ?? null })),
    })),
    materiali: di(() => true),
  };
}

/**
 * Il messaggio dell'utente (§18): la prima domanda crea la conversazione con l'ambito e il titolo; offline resta
 * `in_attesa`, uno solo per conversazione (un secondo testo scritto offline si aggiunge a quello). Restituisce l'id
 * della conversazione.
 */
export function sendMessage(
  db: RoutForgeDb,
  ambito: AmbitoAperto,
  conversazioneId: string | null,
  testo: string,
  now: number,
  online: boolean,
): Promise<string> {
  const t = testo.trim();
  return inTransaction(db, ['conversazioni', 'messaggi'], async () => {
    const prima = conversazioneId ? await get(db, 'conversazioni', conversazioneId) : undefined;
    const c = await save(
      db,
      'conversazioni',
      prima ? { ...prima, ultimoMessaggio: now } : { ...ambito, titolo: t.slice(0, 80), ultimoMessaggio: now },
      now,
    );
    const attesa = (await listBy(db, 'messaggi', 'conversazioneId', c.id)).find((m) => m.stato === 'in_attesa');
    if (attesa) await save(db, 'messaggi', { ...attesa, testo: `${attesa.testo}\n\n${t}` }, now);
    else
      await save(
        db,
        'messaggi',
        { conversazioneId: c.id, ruolo: 'utente', testo: t, istante: now, stato: online ? 'inviato' : 'in_attesa' },
        now,
      );
    return c.id;
  });
}

/**
 * La risposta alla conversazione (§18): regole, materiale dell'ambito e cronologia come turni; `onTesto` riceve il testo
 * man mano che arriva. Interrotta, resta col testo arrivato (`interrotto`); un errore non salva nulla e torna mappato.
 */
export async function answer(
  db: RoutForgeDb,
  conversazioneId: string,
  ora: () => number,
  onTesto: (testo: string) => void,
  segnale: AbortSignal,
): Promise<ErroreAi | null> {
  try {
    const chiave = await readAiKey(db);
    if (!chiave) return 'chiave';
    const conv = await get(db, 'conversazioni', conversazioneId);
    if (!conv || !client) return 'generico';
    const { modelloAi, linguaRisposte } = await readSettings(db);
    const messaggi = await listBy(db, 'messaggi', 'conversazioneId', conversazioneId);
    const sistema = systemInstruction(
      chatContext(await contextOf(db, conv)),
      linguaRisposte === 'auto' ? null : (NOME_INGLESE.of(linguaRisposte) ?? linguaRisposte),
    );
    let testo = '';
    try {
      const pezzi = client.stream(
        { chiave, modello: MODELLI[modelloAi], sistema, turni: chatTurns(messaggi) },
        segnale,
      );
      for await (const p of pezzi) {
        testo += p;
        onTesto(testo);
        if (segnale.aborted) break;
      }
    } catch (e) {
      if (!segnale.aborted) {
        const errore = erroreDi(e);
        if (errore === 'generico') logError('ai', e);
        return errore;
      }
    }
    // Finita senza testo né blocco (limite di token, risposta vuota): non è una risposta
    if (!testo) {
      if (segnale.aborted) return null;
      logError('ai', new Error('risposta vuota'));
      return 'generico';
    }
    // Dopo l'ultimo messaggio anche con l'orologio fermo: la cronologia si ordina per istante
    const istante = Math.max(ora(), ...messaggi.map((m) => m.istante + 1));
    await inTransaction(db, ['conversazioni', 'messaggi'], async () => {
      // Eliminata intanto (col suo corso): la risposta non la fa rinascere (H3)
      const ancora = await get(db, 'conversazioni', conversazioneId);
      if (!ancora) return;
      await save(
        db,
        'messaggi',
        { conversazioneId, ruolo: 'modello', testo, istante, stato: segnale.aborted ? 'interrotto' : 'inviato' },
        istante,
      );
      await save(db, 'conversazioni', { ...ancora, ultimoMessaggio: istante }, istante);
    });
    return null;
  } catch (e) {
    logError('ai', e);
    return 'generico';
  }
}

/** Al ritorno della rete parte il messaggio in attesa di ogni conversazione (§18); restituisce lo stop. */
export function followPendingMessages(db: RoutForgeDb, rete: Rete, ora: () => number): () => void {
  let inCorso = false;
  const invia = async () => {
    if (inCorso || !rete.online()) return;
    inCorso = true;
    try {
      for (const m of (await list(db, 'messaggi')).filter((x) => x.stato === 'in_attesa')) {
        // Resta in attesa finché la risposta non arriva: intanto l'invio della chat è spento e non parte un doppione
        const e = await answer(db, m.conversazioneId, ora, () => undefined, new AbortController().signal);
        // Di nuovo senza rete resta in attesa; con un altro errore, o con la rete «accesa» che non risponde (Wi-Fi con la
        // pagina d'accesso), esce dall'attesa e la chat offre «Riprova»: aspettare il prossimo `online` la bloccava (audit P2-4)
        if (e === 'rete' && !rete.online()) continue;
        if (e) logError('ai', new Error(e));
        const dopo = await get(db, 'messaggi', m.id);
        if (dopo?.stato === 'in_attesa') await save(db, 'messaggi', { ...dopo, stato: 'inviato' }, ora());
      }
    } catch (e) {
      logError('ai', e);
    } finally {
      inCorso = false;
    }
  };
  void invia();
  return rete.onOnline(() => void invia());
}

const ultimaDomanda = async (db: RoutForgeDb, conversazioneId: string) =>
  (await listBy(db, 'messaggi', 'conversazioneId', conversazioneId))
    .filter((m) => m.ruolo === 'utente')
    .sort((a, b) => b.istante - a.istante)[0];

/** La rete è caduta a metà invio (errore «rete»): la domanda torna in attesa e partirà da sola (§18). */
export async function waitForNetwork(db: RoutForgeDb, conversazioneId: string, now: number): Promise<void> {
  const m = await ultimaDomanda(db, conversazioneId).catch(() => undefined);
  if (m) await save(db, 'messaggi', { ...m, stato: 'in_attesa' }, now).catch((e: unknown) => logError('ai', e));
}

/**
 * «Riformula la domanda» dopo un blocco di sicurezza (S19 `chat-error-safety`): la domanda esce dalla conversazione e
 * torna nel campo da modificare; una conversazione rimasta senza messaggi sparisce. Restituisce il testo.
 */
export function takeBackLastMessage(db: RoutForgeDb, conversazioneId: string, now: number): Promise<string> {
  return inTransaction(db, ['conversazioni', 'messaggi'], async () => {
    const m = await ultimaDomanda(db, conversazioneId);
    if (!m) return '';
    await remove(db, 'messaggi', m.id, now);
    if (!(await listBy(db, 'messaggi', 'conversazioneId', conversazioneId)).length)
      await remove(db, 'conversazioni', conversazioneId, now);
    return m.testo;
  });
}

/** «PDF con testo estratto» di S22: quanti PDF entrano nel contesto (§17, H2) su quanti ce ne sono. */
export async function readPdfContext(db: RoutForgeDb): Promise<{ conTesto: number; totali: number }> {
  const pdf = (await list(db, 'materiali')).filter((m) => m.tipo === 'pdf');
  return { conTesto: pdf.filter(isGroundable).length, totali: pdf.length };
}

/**
 * Una generazione dal materiale dell'ambito (§18 «Generazione»; T-027): le regole della generazione e la richiesta, la
 * risposta intera in JSON. Restituisce il testo del modello o l'errore di §18; la chiave resta qui (INV-17).
 */
export async function generateFromScope(
  db: RoutForgeDb,
  ambito: AmbitoAperto,
  richiesta: string,
  segnale: AbortSignal,
): Promise<{ testo: string } | { errore: ErroreAi }> {
  try {
    const chiave = await readAiKey(db);
    if (!chiave) return { errore: 'chiave' };
    if (!client) return { errore: 'generico' };
    const { modelloAi } = await readSettings(db);
    const sistema = generationInstruction(chatContext(await contextOf(db, ambito)));
    const testo = await client.generate(
      { chiave, modello: MODELLI[modelloAi], sistema, turni: [{ ruolo: 'utente', testo: richiesta }] },
      segnale,
    );
    return { testo };
  } catch (e) {
    const errore = erroreDi(e);
    if (errore === 'generico') logError('ai', e);
    return { errore };
  }
}
