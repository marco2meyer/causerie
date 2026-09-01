import { describe, expect, it, vi } from 'vitest';
import { cleanSnippet, paras, playParas } from '../../src/lib/story';

describe('story paragraphs', () => {
  it('splits on blank lines and single newlines, trimming empties', () => {
    expect(paras('Un.\n\nDeux.\n\n\nTrois.')).toEqual(['Un.', 'Deux.', 'Trois.']);
    expect(paras('  Un.  \nDeux.\n\n  ')).toEqual(['Un.', 'Deux.']);
    expect(paras('Une seule ligne.')).toEqual(['Une seule ligne.']);
  });
});

describe('cleanSnippet', () => {
  it('strips edge punctuation but keeps inner apostrophes and hyphens', () => {
    expect(cleanSnippet('«toboggan»,')).toBe('toboggan');
    expect(cleanSnippet('l’église !')).toBe('l’église');
    expect(cleanSnippet('grand-mère…')).toBe('grand-mère');
    expect(cleanSnippet('(déjà)')).toBe('déjà');
  });
});

describe('playParas', () => {
  const flush = () => new Promise(r => setTimeout(r, 0));

  it('reveals questions per finished paragraph, in order', async () => {
    const spoken: string[] = [];
    const speak = vi.fn(async (t: string) => { spoken.push(t); });
    const heard: number[] = [];
    let done = false;
    playParas(['Un.', 'Deux.', 'Trois.'], 0, speak, h => heard.push(h), () => { done = true; });
    await flush();
    expect(spoken).toEqual(['Un.', 'Deux.', 'Trois.']);
    expect(heard).toEqual([1, 2, 3]);
    expect(done).toBe(true);
  });

  it('resumes from a later paragraph', async () => {
    const spoken: string[] = [];
    const heard: number[] = [];
    playParas(['Un.', 'Deux.', 'Trois.'], 2, async t => { spoken.push(t); }, h => heard.push(h), () => { /* */ });
    await flush();
    expect(spoken).toEqual(['Trois.']);
    expect(heard).toEqual([3]);
  });

  it('cancel stops before the next chunk and still calls onDone once', async () => {
    let resolveFirst: () => void = () => { /* */ };
    const speak = vi.fn((t: string) => new Promise<void>(r => { if (speak.mock.calls.length === 1) resolveFirst = r; else r(); }));
    const heard: number[] = [];
    let doneCount = 0;
    const cancel = playParas(['Un.', 'Deux.'], 0, speak, h => heard.push(h), () => { doneCount++; });
    cancel();          // cancel while the first chunk is "playing"
    resolveFirst();
    await flush();
    expect(heard).toEqual([]); // the interrupted paragraph does not count as heard
    expect(speak).toHaveBeenCalledTimes(1);
    expect(doneCount).toBe(1);
  });
});
