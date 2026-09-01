import { describe, expect, it } from 'vitest';
import { AN_SCHEMA, buildAnalysisMessages, parseAnalysisContent, sseAccumulator } from '../../src/lib/analysis';
import { seedMem } from '../../src/lib/seed';

describe('parseAnalysisContent', () => {
  const obj = { hauptpunkt: 'x' };
  it('parses plain JSON', () => {
    expect(parseAnalysisContent(JSON.stringify(obj)).hauptpunkt).toBe('x');
  });
  it('strips markdown fences', () => {
    expect(parseAnalysisContent('```json\n' + JSON.stringify(obj) + '\n```').hauptpunkt).toBe('x');
  });
  it('skips leading prose before the object', () => {
    expect(parseAnalysisContent('Here is the JSON:\n' + JSON.stringify(obj)).hauptpunkt).toBe('x');
  });
  it('throws on garbage', () => {
    expect(() => parseAnalysisContent('no json here')).toThrow();
  });
});

describe('sseAccumulator', () => {
  const ev = (delta: string) => 'data: ' + JSON.stringify({ choices: [{ delta: { content: delta } }] }) + '\n';

  it('accumulates deltas across events and stops at [DONE]', () => {
    const a = sseAccumulator();
    a.push(ev('{"haupt') + ev('punkt":"x"}') + 'data: [DONE]\n');
    a.end();
    expect(a.content).toBe('{"hauptpunkt":"x"}');
  });

  it('survives lines split across arbitrary chunk boundaries', () => {
    const raw = ev('AB') + ev('CD') + 'data: [DONE]\n';
    for (const cut of [1, 5, 17, raw.length - 2]) {
      const a = sseAccumulator();
      a.push(raw.slice(0, cut));
      a.push(raw.slice(cut));
      a.end();
      expect(a.content).toBe('ABCD');
    }
  });

  it('captures the trailing usage event and ignores malformed lines', () => {
    const a = sseAccumulator();
    a.push(ev('X') + 'data: {broken\n' + 'data: ' + JSON.stringify({ choices: [], usage: { completion_tokens: 42 } }) + '\n');
    a.end();
    expect(a.content).toBe('X');
    expect((a.usage as { completion_tokens: number }).completion_tokens).toBe(42);
  });

  it('accepts a collapsed non-stream message shape (buffering proxies)', () => {
    const a = sseAccumulator();
    a.push('data: ' + JSON.stringify({ choices: [{ message: { content: '{"ok":1}' } }] }));
    a.end(); // no trailing newline: end() must flush the tail
    expect(a.content).toBe('{"ok":1}');
  });
});

describe('buildAnalysisMessages', () => {
  it('numbers student turns and passes memory context', () => {
    const m = seedMem('Marco');
    const msgs = buildAnalysisMessages(m, { topic: 'Natur', targets: [] }, [
      { role: 'assistant', text: 'Salut.' },
      { role: 'user', text: 'Bonjour.' },
      { role: 'assistant', text: 'Ça va?' },
      { role: 'user', text: 'Oui.' }
    ]);
    expect(msgs).toHaveLength(2);
    expect(msgs[1].content).toContain('S0 (Student): Bonjour.');
    expect(msgs[1].content).toContain('S1 (Student): Oui.');
    expect(msgs[1].content).toContain('open_weaknesses');
    expect(msgs[1].content).toContain('jamais + de');
    expect(msgs[0].content).toContain('CEFR');
  });
});

describe('AN_SCHEMA', () => {
  it('requires every top-level field (strict json_schema)', () => {
    const props = Object.keys(AN_SCHEMA.schema.properties);
    expect([...AN_SCHEMA.schema.required].sort()).toEqual(props.sort());
    expect(AN_SCHEMA.strict).toBe(true);
  });
});
