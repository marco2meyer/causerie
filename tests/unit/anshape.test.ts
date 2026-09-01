import { describe, expect, it, vi } from 'vitest';
import { normalizeAnalysis } from '../../src/lib/anshape';
import { parseAnalysisContent } from '../../src/lib/analysis';
import { blankMem, migrate } from '../../src/lib/storage';
import { changedWords } from '../../src/lib/utils';
import type { Memory, SessionRecord } from '../../src/types';

/* One correction with a missing field used to cost the student the whole debrief: the
 * review's recast panels call changedWords on it during render, and a throw there unmounts
 * the app and leaves a blank white page. Three lines of defence, each pinned here: the diff
 * itself, the door new analyses come through, and the door stored ones come back through. */

describe('changedWords', () => {
  it('treats a missing side as an empty sentence rather than throwing', () => {
    expect(() => changedWords(undefined, 'je suis allé')).not.toThrow();
    expect(() => changedWords('je suis allé', undefined)).not.toThrow();
    expect(() => changedWords(null, null)).not.toThrow();
    expect(changedWords(undefined, 'deux mots').map(w => w.w)).toEqual(['deux', 'mots']);
    expect(changedWords(undefined, 'deux mots').every(w => w.ch)).toBe(true);
    expect(changedWords('deux mots', undefined)).toEqual([]);
  });

  it('still marks only what moved', () => {
    expect(changedWords('je suis allé au cinéma', 'je suis allée au cinéma')
      .filter(w => w.ch).map(w => w.w)).toEqual(['allée']);
  });
});

describe('normalizeAnalysis', () => {
  it('fills every list the screens iterate over', () => {
    const an = normalizeAnalysis({});
    for (const k of ['corrections', 'highlights', 'new_vocab', 'weaknesses', 'strengths',
      'interests', 'facts', 'competencies', 'targets', 'next_focus', 'topics'] as const) {
      expect(Array.isArray(an[k]), k).toBe(true);
    }
    expect(an.prune).toEqual({ facts: [], interests: [] });
    expect(an.hauptpunkt).toBe('');
  });

  it('replaces a list that is not a list, and drops entries that are not objects', () => {
    const an = normalizeAnalysis({ corrections: 'none', highlights: {}, new_vocab: [null, 3] });
    expect(an.corrections).toEqual([]);
    expect(an.highlights).toEqual([]);
    expect(an.new_vocab).toEqual([]);
  });

  it('makes every correction field a string, whatever the model sent', () => {
    const [c] = normalizeAnalysis({ corrections: [{ user_turn: '2', besser: 'je suis allé' }] }).corrections;
    expect(c.original).toBe('');
    expect(c.besser).toBe('je suis allé');
    expect(c.erklaerung).toBe('');
    expect(c.user_turn).toBe(2);
  });

  it('keeps what the model did send', () => {
    const an = normalizeAnalysis({ hauptpunkt: 'x', topics: ['cinéma'], interests: ['film'] });
    expect(an.hauptpunkt).toBe('x');
    expect(an.topics).toEqual(['cinéma']);
    expect(an.interests).toEqual(['film']);
  });
});

/* The call of 23 August 2026 came back from the schema-less retry with a schema of its own
 * invention. Its words were in the memory the whole time, under names nothing read — this is
 * that exact record's shape, so the recovery cannot quietly stop working. */
describe('normalizeAnalysis, on the names a model actually invented', () => {
  const wild = {
    hauptpunkt: 'Bonne conversation.',
    corrections: [{
      user_turn: 3, category: 'grammaire',
      original: "Ah, c'est réunion Zoom.",
      corrected: 'Ah, c’est une réunion sur Zoom.',
      erklaerung: '« Réunion » est féminin.',
      cloze_text: 'Ah, c’est ___ réunion sur Zoom.', cloze_answer: 'une', hint: 'unbestimmter Artikel'
    }],
    new_vocab: [
      { term: 'l’ordre du jour', meaning: 'la liste des sujets d’une réunion', example: 'un ordre du jour' },
      { term: 'davantage', meaning: 'plus', example: 'travailler davantage' }
    ],
    praise: [{ label: 'Description d’un concept abstrait', begruendung: 'La phrase est claire et structurée.' }]
  };

  it('reads the recast out of `corrected`', () => {
    expect(normalizeAnalysis(wild).corrections[0].besser).toBe('Ah, c’est une réunion sur Zoom.');
  });

  it('reads the words out of term/meaning/example', () => {
    const v = normalizeAnalysis(wild).new_vocab;
    expect(v.map(x => x.fr)).toEqual(['l’ordre du jour', 'davantage']);
    expect(v[0].de).toBe('la liste des sujets d’une réunion');
    expect(v[0].ex).toBe('un ordre du jour');
  });

  it('reads the praise out of `praise`', () => {
    const h = normalizeAnalysis(wild).highlights;
    expect(h).toHaveLength(1);
    expect(h[0].kommentar).toBe('La phrase est claire et structurée.');
  });

  it('drops a vocabulary entry with no word, so the deck fallback can take over', () => {
    const v = normalizeAnalysis({ new_vocab: [{ de: 'nur eine Übersetzung' }, { term: 'davantage' }] }).new_vocab;
    expect(v.map(x => x.fr)).toEqual(['davantage']);
  });

  it('leaves a canonical analysis exactly as it was', () => {
    const canon = {
      corrections: [{ original: 'a', besser: 'b' }],
      new_vocab: [{ fr: 'le mot', de: 'das Wort', ex: 'un mot' }],
      highlights: [{ user_turn: 1, quote: 'q', kommentar: 'k' }]
    };
    const an = normalizeAnalysis(canon);
    expect(an.corrections[0].besser).toBe('b');
    expect(an.new_vocab[0]).toMatchObject({ fr: 'le mot', de: 'das Wort', ex: 'un mot' });
    expect(an.highlights[0]).toMatchObject({ user_turn: 1, quote: 'q', kommentar: 'k' });
  });
});

describe('parseAnalysisContent', () => {
  it('normalizes what it parses, so a schema-less reply cannot store a half-correction', () => {
    const an = parseAnalysisContent(JSON.stringify({ corrections: [{ besser: 'mieux' }] }));
    expect(an.corrections[0].original).toBe('');
    expect(() => changedWords(an.corrections[0].original, an.corrections[0].besser)).not.toThrow();
  });
});

describe('migrate', () => {
  it('repairs analyses already stored from before the shape was enforced', () => {
    const m = blankMem();
    m.sessions.push({
      id: 's1', date: '2026-08-23', topic: 'Le cinéma', source: 'causerie', minutes: 9,
      transcript: [], summary: '',
      analysis: { corrections: [{ besser: 'mieux' }] }
    } as unknown as SessionRecord);
    const out = migrate(JSON.parse(JSON.stringify(m)))!;
    expect(out.sessions[0].analysis!.corrections[0].original).toBe('');
    expect(Array.isArray(out.sessions[0].analysis!.highlights)).toBe(true);
  });

  it('drops a vocabulary entry the same bug left with no word', () => {
    const m = blankMem();
    m.vocab.push({ fr: 'le mot', de: 'das Wort', ex: '', date: '2026-08-22' });
    m.vocab.push({ date: '2026-08-23' } as unknown as Memory['vocab'][number]);
    const out = migrate(JSON.parse(JSON.stringify(m)))!;
    expect(out.vocab.map(v => v.fr)).toEqual(['le mot']);
  });

  it('leaves a conversation saved without an analysis alone', () => {
    const m = blankMem();
    m.sessions.push({
      id: 's2', date: '2026-08-23', topic: 'x', source: 'causerie', minutes: 3,
      transcript: [], analysis: null, summary: ''
    } as unknown as SessionRecord);
    expect(migrate(JSON.parse(JSON.stringify(m)))!.sessions[0].analysis).toBeNull();
  });
});

/* The schema-less retry exists for a model that refuses `response_format`. It used to run
 * as the SECOND attempt of the FIRST model, so any transient error on the preferred model
 * threw away the one guarantee the shape had — and a schema-less reply is what put a
 * half-written correction in the memory in the first place. Every model gets the schema
 * before any model goes without. */
/** A fetch stub that answers every attempt with the same status, recording what was sent. */
async function attemptsUnder(status: number, body: string) {
  vi.resetModules();
  const store = new Map<string, string>();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); }
  });
  const tried: { model: string; schema: boolean }[] = [];
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    const b = JSON.parse(init.body);
    tried.push({ model: b.model, schema: !!b.response_format });
    return { ok: false, status, text: async () => body } as unknown as Response;
  });
  const { runAnalysis } = await import('../../src/lib/analysis');
  await expect(runAnalysis(blankMem(), { topic: 'x', targets: [], mode: 'daily' },
    [{ role: 'user', text: 'bonjour' }] as never)).rejects.toThrow();
  vi.unstubAllGlobals();
  return tried;
}

/* The 23 August call: something transient killed the schema request — it never billed a
 * token, so it died before the model wrote anything — and the retry went out without the
 * schema. The reply came back in a schema of the model's own invention and the memory kept
 * it. A network failure says nothing about whether a model can honour a schema. */
describe('runAnalysis only drops the schema when a model refuses it', () => {
  it('never goes schema-less on a transient failure', async () => {
    for (const [status, body] of [[500, 'internal error'], [429, 'rate limited'], [503, 'overloaded']] as const) {
      const tried = await attemptsUnder(status, body);
      expect(tried.length, String(status)).toBeGreaterThan(0);
      expect(tried.every(t => t.schema), String(status)).toBe(true);
    }
  });

  it('goes schema-less when a model turns response_format down', async () => {
    const tried = await attemptsUnder(400, "Invalid parameter: 'response_format' of type 'json_schema' is not supported.");
    expect(tried.some(t => !t.schema)).toBe(true);
  });

  it('treats a 400 that is not about the schema as transient', async () => {
    const tried = await attemptsUnder(400, 'context_length_exceeded');
    expect(tried.every(t => t.schema)).toBe(true);
  });
});

describe('runAnalysis fallback order', () => {
  it('walks the whole chain with the schema before dropping it', async () => {
    // Every model refuses the schema, so the bare pass is earned — and only then.
    const tried = await attemptsUnder(400, "'response_format' json_schema is not supported");
    const models = new Set(tried.map(t => t.model));
    expect(models.size).toBeGreaterThan(1);
    const firstBare = tried.findIndex(t => !t.schema);
    const lastWithSchema = tried.map(t => t.schema).lastIndexOf(true);
    expect(firstBare).toBeGreaterThan(-1);
    // NOT "the bare attempt comes late for this model" — no bare attempt at all until every
    // model has refused the schema.
    expect(lastWithSchema).toBeLessThan(firstBare);
    expect(new Set(tried.slice(0, firstBare).map(t => t.model)).size).toBe(models.size);
  });
});

