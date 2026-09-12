import type { Memory } from '../types';
import { compById } from '../lib/competencies';
import { grammarOf, grammarQueue, grammarState, learningTopics } from '../lib/grammar';
import { todayISO } from '../lib/utils';
import { ui } from '../lang';

/** What the app is going to teach next, in what order, and what it considers finished.
 *
 *  It lives in the memory rather than in the settings because that is what it IS: a reading
 *  of the competency map, the same map the tab beside it draws. The order is the part worth
 *  touching — the app's own ranking (worst gap at or below the learner's band, foundations
 *  before frontier) is a good default and a bad rule, and a student with an exam in three
 *  weeks knows better than the matrix which five concepts matter.
 *
 *  Reordering is arrows rather than dragging: a drag-and-drop list is the wrong bet on a
 *  phone in a warm hand, and there is no such primitive anywhere else in this app to copy. */
export function GrammarQueue({ mem, update }: { mem: Memory; update: (fn: (m: Memory) => void) => void }) {
  const S = ui();
  const g = grammarOf(mem);
  const byId = compById(mem.profile.target);
  // Eight is as far as a settings list is worth reading; the ranking behind it is still the
  // whole map, which is what the arrows are disabled against.
  const queueAll = grammarQueue(mem);
  const queue = queueAll.slice(0, 8);
  const learning = learningTopics(mem);
  const mastered = Object.entries(g.topics)
    .filter(([, t]) => t.masteredAt || t.manual)
    .sort((a, b) => String(b[1].masteredAt ?? '').localeCompare(String(a[1].masteredAt ?? '')));

  /** Moves a concept one place within the queue.
   *
   *  The stored order is the queue AS SHOWN, cut off after the moved concept: everything
   *  above it is now pinned, everything below goes on being ranked automatically. Storing
   *  the whole list instead would freeze the tail too, and a gap that opens up next week
   *  would never be able to climb past a concept the student merely scrolled past today. */
  const move = (id: string, by: number) => update(m => {
    const ranked = grammarQueue(m).map(c => c.id);
    const i = ranked.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= ranked.length) return;
    [ranked[i], ranked[j]] = [ranked[j], ranked[i]];
    grammarState(m).order = ranked.slice(0, Math.max(i, j) + 1);
  });

  const setStatus = (id: string, what: 'done' | 'reopen' | 'skip' | 'unskip') => update(m => {
    const st = grammarState(m);
    if (what === 'done') {
      // An empty `courseAt` is what says "nobody ever taught this, the student simply says
      // they know it". `manual` cannot carry that meaning, because it is also stamped on a
      // concept that WAS taught and drilled and is being retired early — and reopening one
      // of those must give the student their history back, not throw it away.
      st.topics[id] = { ...(st.topics[id] ?? { courseAt: '', days: [] }), masteredAt: todayISO(), manual: 1 };
      st.order = st.order.filter(x => x !== id);
    } else if (what === 'reopen') {
      const t = st.topics[id];
      if (t && !t.courseAt) delete st.topics[id];        // never taught: back onto the queue
      else if (t) {
        // Taught before, and the student is saying it did not stick after all. Everything
        // from the last teaching stops being evidence, exactly as a redo does — otherwise
        // the next sitting re-masters it on the very tallies just contradicted.
        delete t.masteredAt;
        delete t.manual;
        t.redoneAt = todayISO();
      }
      st.skipped = st.skipped.filter(x => x !== id);
    } else if (what === 'skip') {
      st.skipped = [...st.skipped.filter(x => x !== id), id];
      st.order = st.order.filter(x => x !== id);
    } else {
      st.skipped = st.skipped.filter(x => x !== id);
    }
  });

  return (
    <div>
      <p class="muted" style="margin:0 0 12px;font-size:14px;line-height:1.5">{S.gram.queueIntro}</p>

      {/* What is being worked on and what is queued behind it, in the order they will come. */}
      <div class="kicker" style="margin-top:4px">{S.gram.queue}</div>
      {queue.length === 0 && learning.length === 0
        ? <div class="tiny" style="margin-top:6px">{S.gram.queueEmpty}</div>
        : (
          <div class="gset">
            {/* Being taught right now: it holds its place until it is mastered, so it has
                no arrows — there is nowhere for it to move to. */}
            {learning.map(id => {
              const item = byId[id];
              if (!item) return null;
              return (
                <div key={id} class="gsetrow on">
                  <span class="lvl">{item.band}</span>
                  <span class="gsetlab" lang={mem.profile.target}>{item.label}</span>
                  <div class="gsetacts">
                    <button class="btn subtle" onClick={() => setStatus(id, 'done')}>{S.gram.markDone}</button>
                  </div>
                </div>
              );
            })}
            {/* Queued behind it, in the order they will come. Indices here are the QUEUE's
                own, not the list's, so the arrows are disabled exactly when they would do
                nothing rather than one row out. */}
            {queue.map((item, i) => (
              <div key={item.id} class="gsetrow">
                <span class="lvl">{item.band}</span>
                <span class="gsetlab" lang={mem.profile.target}>{item.label}</span>
                <div class="gsetacts">
                  <button class="btn subtle" title={S.gram.up} aria-label={S.gram.up}
                    disabled={i === 0} onClick={() => move(item.id, -1)}>↑</button>
                  <button class="btn subtle" title={S.gram.down} aria-label={S.gram.down}
                    disabled={i === queueAll.length - 1} onClick={() => move(item.id, 1)}>↓</button>
                  <button class="btn subtle" onClick={() => setStatus(item.id, 'done')}>{S.gram.markDone}</button>
                  <button class="btn subtle" onClick={() => setStatus(item.id, 'skip')}>{S.gram.skip}</button>
                </div>
              </div>
            ))}
          </div>
        )}

      {mastered.length > 0 && (
        <div>
          <div class="kicker" style="margin-top:14px">{S.gram.done}</div>
          <div class="gset">
            {mastered.map(([id, t]) => {
              const item = byId[id];
              if (!item) return null;
              return (
                <div key={id} class="gsetrow">
                  <span class="lvl">{item.band}</span>
                  <span class="gsetlab" lang={mem.profile.target}>
                    {item.label}{t.manual ? ' · ' + S.gram.manual : ''}
                  </span>
                  <div class="gsetacts">
                    <button class="btn subtle" onClick={() => setStatus(id, 'reopen')}>{S.gram.reopen}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {g.skipped.length > 0 && (
        <div>
          <div class="kicker" style="margin-top:14px">{S.gram.skipped}</div>
          <div class="gset">
            {g.skipped.map(id => {
              const item = byId[id];
              if (!item) return null;
              return (
                <div key={id} class="gsetrow">
                  <span class="lvl">{item.band}</span>
                  <span class="gsetlab" lang={mem.profile.target}>{item.label}</span>
                  <div class="gsetacts">
                    <button class="btn subtle" onClick={() => setStatus(id, 'unskip')}>{S.gram.unskip}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
