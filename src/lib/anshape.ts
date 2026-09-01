import type { Analysis } from '../types';

const asText = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const asList = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter(x => x && typeof x === 'object') as Record<string, unknown>[] : [];
const asLabels = (v: unknown): string[] => (Array.isArray(v) ? v.filter(x => x != null).map(asText) : []);
/** First of these keys that carries something. */
const pick = (o: Record<string, unknown>, ...keys: string[]): string => {
  for (const k of keys) { const t = asText(o[k]); if (t) return t; }
  return '';
};

/** Beats a parsed reply into the shape the rest of the app is written against.
 *
 *  The strict json_schema guarantees this shape, but the schema is not always in play: a
 *  model that rejects `response_format` is retried without it, and then the reply is only
 *  as well-formed as the model felt like being. What comes back goes straight into the
 *  memory and is read months later by screens that trust their types — a correction with no
 *  `original`, or a `corrections` that is not a list, is not a smaller analysis, it is a
 *  render that throws, and the student loses the whole debrief for the sake of one field.
 *
 *  So the shape is enforced here, once, at the only door analyses come through. Missing
 *  strings become empty, non-lists become empty lists: a thinner report, still readable.
 *
 *  The alternative key names are not a guess at what a model MIGHT write — each one is a
 *  name a model actually did write, in the call of 23 August 2026, which came back with a
 *  schema of its own invention: `corrected` for besser, `term`/`meaning`/`example` for a
 *  vocabulary entry, `praise` with `begruendung` for the highlights. That call's words were
 *  sitting in the memory the whole time under names nothing read. Only observed names are
 *  accepted here; inventing more would be pretending to know what the next one looks like. */
export function normalizeAnalysis(raw: unknown): Analysis {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    ...(a as unknown as Analysis),
    hauptpunkt: asText(a.hauptpunkt),
    kommentar: asText(a.kommentar),
    corrections: asList(a.corrections).map(c => ({
      ...c,
      user_turn: Number(c.user_turn) || 0,
      original: asText(c.original), besser: pick(c, 'besser', 'corrected'), erklaerung: asText(c.erklaerung),
      category: asText(c.category), cefr_topic: asText(c.cefr_topic),
      cloze_text: asText(c.cloze_text), cloze_answer: asText(c.cloze_answer), hint: asText(c.hint)
    })) as unknown as Analysis['corrections'],
    highlights: (asList(a.highlights).length ? asList(a.highlights) : asList(a.praise)).map(h => ({
      ...h, user_turn: Number(h.user_turn) || 0,
      quote: asText(h.quote), kommentar: pick(h, 'kommentar', 'begruendung')
    })) as unknown as Analysis['highlights'],
    // A word with no word is not a word. Dropping the empty ones matters: the debrief only
    // falls back to the cards a call produced when this list is EMPTY, so four blank rows
    // hid the words instead of showing them.
    new_vocab: asList(a.new_vocab).map(v => ({
      ...v, fr: pick(v, 'fr', 'term'), de: pick(v, 'de', 'meaning'), ex: pick(v, 'ex', 'example')
    })).filter(v => v.fr) as unknown as Analysis['new_vocab'],
    weaknesses: asList(a.weaknesses).map(w => ({
      ...w, label: asText(w.label), evidence: asText(w.evidence)
    })) as unknown as Analysis['weaknesses'],
    strengths: asList(a.strengths).map(x => ({
      ...x, label: asText(x.label), evidence: asText(x.evidence)
    })) as unknown as Analysis['strengths'],
    interests: asLabels(a.interests),
    facts: asList(a.facts).map(f => ({ ...f, text: asText(f.text) })) as unknown as Analysis['facts'],
    prune: {
      facts: asLabels((a.prune as Record<string, unknown> | undefined)?.facts),
      interests: asLabels((a.prune as Record<string, unknown> | undefined)?.interests)
    },
    competencies: asList(a.competencies).map(c => ({
      ...c, label: asText(c.label), evidence: asText(c.evidence)
    })) as unknown as Analysis['competencies'],
    targets: asList(a.targets).map(t => ({
      ...t, label: asText(t.label), achieved: !!t.achieved, evidence: asText(t.evidence)
    })) as unknown as Analysis['targets'],
    next_focus: asList(a.next_focus).map(f => ({
      ...f, label: asText(f.label), grund: asText(f.grund)
    })) as unknown as Analysis['next_focus'],
    topics: asLabels(a.topics)
  };
}
