/* End-to-end suite. Runs the BUILT app (dist/) in headless Chromium with a fake microphone.
 *
 *   npm run build && OPENAI_KEY=sk-… npm run test:e2e          # UI flows only
 *   npm run build && OPENAI_KEY=sk-… LIVE=1 npm run test:e2e   # + real SDP handshake + real analysis
 *
 * In sandboxes without direct egress, set HTTPS_PROXY; the browser reaches OpenAI through
 * tests/e2e/relay.mjs (the app honors the window.CAUSERIE_OAI override). Note: WebRTC *media*
 * cannot flow through an HTTP proxy, so LIVE asserts the SDP exchange (session accepted),
 * not audible audio — run one real call in a normal browser for that.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const shots = path.join(here, 'shots');
mkdirSync(shots, { recursive: true });

const KEY = process.env.OPENAI_KEY || '';
/** With ACCESS_CODE set, dist is served through bridge.mjs (which forwards /api/* to
 *  production): the whole suite, including LIVE, runs without any OpenAI key here. */
const CODE = process.env.ACCESS_CODE || '';
const LIVE = process.env.LIVE === '1';
const BASE = 'http://127.0.0.1:8123';
const CHROME = process.env.CHROMIUM_PATH || undefined;

const server = CODE
  ? spawn('node', [path.join(here, 'bridge.mjs'), '8123'], { stdio: 'inherit', env: process.env })
  : spawn('python3', ['-m', 'http.server', '8123', '--bind', '127.0.0.1'], { cwd: path.join(root, 'dist'), stdio: 'ignore' });
const relay = spawn('node', [path.join(here, 'relay.mjs')], { stdio: 'inherit', env: process.env });
await new Promise(r => setTimeout(r, 1200));

const browser = await chromium.launch({
  ...(CHROME ? { executablePath: CHROME } : {}),
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']
});
const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2, locale: 'fr-FR' }); // signup follows the browser locale
await ctx.grantPermissions(['microphone'], { origin: BASE });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));

const cleanup = () => { try { server.kill(); relay.kill(); } catch { /* noop */ } };
const fail = async (msg) => {
  console.log('FAIL:', msg);
  console.log(logs.slice(-25).join('\n'));
  await page.screenshot({ path: shots + '/fail.png', fullPage: true }).catch(() => {});
  cleanup();
  process.exit(1);
};
const shot = (n, full = false) => page.screenshot({ path: `${shots}/${n}.png`, fullPage: full });

try {
  /* ---- onboarding ---- */
  await page.addInitScript(() => { window.CAUSERIE_OAI = 'http://127.0.0.1:8124'; });
  await page.goto(BASE);
  await page.waitForSelector('text=La tutrice', { timeout: 8000 });
  await shot('01-onboard', true);
  await page.locator('input').first().fill('Marco');
  await page.click('.pills >> text=B1'); // B1: keeps the UI in the target language (below B1 it runs in the support language)
  await page.fill('input[type=password]', CODE || KEY || 'sk-invalid');
  if (!KEY && !CODE) {
    await page.click('text=C’est parti');
    await page.waitForSelector('.toast', { timeout: 9000 });
    console.log('no-key path OK (validation rejects an invalid key)');
    cleanup();
    process.exit(0);
  }
  await page.click('text=C’est parti');
  await page.waitForSelector('.tuto-card', { timeout: 15000 }); // first-login tutorial
  await shot('01b-tutorial', true);
  await page.click('.tuto-card >> text=Passer');
  await page.waitForSelector('text=Odile propose', { timeout: 15000 });
  // The Duolingo starter toggle is gone from signup: seed the reference deck directly.
  await page.evaluate(() => {
    const C = window.causerie;
    const m = C.seedMem('Marco');
    m.settings.uiLang = 'target'; // the seed is A2: force the French UI so the suite's selectors hold
    C.saveMem(m);
  });
  await page.reload();
  await page.waitForSelector('text=Odile propose', { timeout: 15000 });
  await shot('02-today', true);

  /* ---- starter deck + review session (Fluent-Forever loop) ---- */
  await page.click('nav >> text=Cartes');
  await page.waitForSelector('h2:has-text("Cartes")');
  const deckTotal = await page.evaluate(() => window.causerie.dueCounts(window.causerie.loadMem().deck).total);
  if (deckTotal !== 12) await fail('expected 12 seeded cards, got ' + deckTotal);
  await shot('03-deck', true);
  await page.click('button:has-text("Réviser")');
  await page.waitForSelector('.rev-card', { timeout: 8000 });
  await shot('04-review-card');
  for (let i = 0; i < 30; i++) {
    if (await page.locator('text=Révision terminée').count()) break;
    try { await page.click('text=Retourner', { timeout: 4000 }); } catch { continue; } // done screen may land mid-iteration
    await page.waitForSelector('.gradebar', { timeout: 5000 });
    if (i === 0) await shot('05-review-revealed');
    await page.click('.gradebar >> text=Bien');
    await page.waitForTimeout(150);
  }
  await page.waitForSelector('text=Révision terminée', { timeout: 8000 });
  await shot('06-review-done');
  const afterReview = await page.evaluate(() => {
    const m = window.causerie.loadMem();
    return { log: m.deck.log.length, reviewed: m.deck.cards.filter(c => c.state === 'review').length, xp: m.xp };
  });
  if (afterReview.log !== 1 || afterReview.reviewed < 8) await fail('review session did not persist: ' + JSON.stringify(afterReview));
  console.log('review session OK:', JSON.stringify(afterReview));
  await page.click('.rev-actions >> button:has-text("Terminé")');
  await page.waitForSelector('text=Ta révision');

  /* ---- personalize a card: draw an image, expect the thumbnail + flag ---- */
  await page.click('nav >> text=Cartes');
  await page.waitForSelector('.cardrow');
  await page.click('.cardrow >> nth=0 >> button[title="Personnaliser (image)"]');
  await page.waitForSelector('.doodle');
  const box = await page.locator('.doodle').boundingBox();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 8 });
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.8, { steps: 8 });
  await page.mouse.up();
  await shot('06b-doodle');
  await page.click('button:has-text("Garder ce dessin")');
  await page.waitForSelector('.cardrow >> nth=0 >> img.thumb', { timeout: 8000 });
  const withImg = await page.evaluate(() => window.causerie.loadMem().deck.cards.filter(c => c.img === 1).length);
  if (withImg !== 1) await fail('expected exactly one card flagged with an image, got ' + withImg);
  // reopening shows the stored image, which can be drawn over (image becomes canvas background)
  await page.click('.cardrow >> nth=0 >> button[title="Personnaliser (image)"]');
  await page.waitForSelector('.pz-existing img', { timeout: 6000 });
  await page.click('button:has-text("Dessiner dessus")');
  await page.waitForSelector('.doodle');
  const box2 = await page.locator('.doodle').boundingBox();
  await page.mouse.move(box2.x + box2.width * 0.2, box2.y + box2.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box2.x + box2.width * 0.8, box2.y + box2.height * 0.35, { steps: 6 });
  await page.mouse.up();
  await page.click('button:has-text("Garder ce dessin")');
  await page.waitForSelector('.cardrow >> nth=0 >> img.thumb', { timeout: 8000 });
  console.log('card personalization (drawing + draw-over) OK');

  /* ---- status filter + sort (new / learning ✓|✗ / learned / paused) ---- */
  const stageExp = await page.evaluate(() => {
    const MATURE = 21;
    const cs = window.causerie.loadMem().deck.cards;
    const stg = c => c.state === 'suspended' ? 'suspended' : c.state === 'new' ? 'new'
      : c.state === 'review' && c.interval >= MATURE ? 'learned' : 'learning';
    const known = c => c.lastGrade === 'good' || c.lastGrade === 'easy';
    return {
      all: cs.length,
      new: cs.filter(c => stg(c) === 'new').length,
      learning: cs.filter(c => stg(c) === 'learning').length,
      learningKnown: cs.filter(c => stg(c) === 'learning' && known(c)).length
    };
  });
  if (stageExp.learning < 1 || stageExp.new < 1) await fail('post-review deck lacks stage mix: ' + JSON.stringify(stageExp));
  const rows = () => page.locator('.cardrow').count();
  if (await rows() !== stageExp.all) await fail('unfiltered list count wrong');
  await page.click('.fchips >> button:has-text("En cours")');
  if (await rows() !== stageExp.learning) await fail(`learning filter: ${await rows()} rows, expected ${stageExp.learning}`);
  await page.click('.fchips >> button:has-text("✓ sue")');
  if (await rows() !== stageExp.learningKnown) await fail(`✓ sue filter: ${await rows()} rows, expected ${stageExp.learningKnown}`);
  await shot('06b2-filter-learning-known');
  await page.click('.fchips >> button:has-text("✗ ratée")');
  if (await rows() !== stageExp.learning - stageExp.learningKnown) await fail('✗ ratée filter wrong');
  await page.click('.fchips >> button:has-text("Nouvelles")');
  if (await rows() !== stageExp.new) await fail(`new filter: ${await rows()} rows, expected ${stageExp.new}`);
  await page.click('.fchips >> button:has-text("statut")');   // status sort applies without error
  await page.click('.fchips >> button:has-text("Toutes")');
  if (await rows() !== stageExp.all) await fail('reset to all failed');
  const firstMarker = await page.locator('.cardrow >> nth=0 >> .stg').getAttribute('class');
  if (!/stg (new|learning|learned|suspended)/.test(firstMarker)) await fail('stage marker missing: ' + firstMarker);
  console.log('status filter + sort OK:', JSON.stringify(stageExp));

  /* ---- delete with undo (no confirm dialog, a 6s undo toast instead) ---- */
  const beforeDel = await page.evaluate(() => window.causerie.loadMem().deck.cards.length);
  await page.click('.cardrow >> nth=0 >> button[title="Supprimer"]');
  await page.waitForSelector('.toast >> text=Carte supprimée');
  if (await page.evaluate(() => window.causerie.loadMem().deck.cards.length) !== beforeDel - 1) await fail('delete did not remove the card');
  await page.click('.toast-act');
  await page.waitForTimeout(250);
  if (await page.evaluate(() => window.causerie.loadMem().deck.cards.length) !== beforeDel) await fail('undo did not restore the card');
  console.log('card delete + undo OK');

  /* ---- interrupted review survives a reload (train-transfer case) ---- */
  await page.click('button:has-text("Réviser")');
  await page.waitForSelector('.rev-card', { timeout: 8000 });
  for (let i = 0; i < 2; i++) {
    await page.click('text=Retourner');
    await page.waitForSelector('.gradebar', { timeout: 5000 });
    await page.click('.gradebar >> text=Bien');
    await page.waitForTimeout(200);
  }
  await page.reload();
  await page.waitForSelector('nav >> text=Aujourd’hui', { timeout: 15000 });
  await page.click('nav >> text=Cartes');
  await page.waitForSelector('button:has-text("Reprendre 2/")', { timeout: 8000 });
  await shot('06b3-resume-offer');
  await page.click('button:has-text("Reprendre 2/")');
  await page.waitForSelector('.rev-card', { timeout: 8000 });
  const resumePos = await page.locator('.rev-top .tiny').innerText();
  if (!resumePos.startsWith('2/')) await fail('resumed session lost its position: ' + resumePos);
  await page.click('.rev-top >> button:has-text("Terminer")');
  await page.waitForSelector('text=Révision terminée', { timeout: 8000 });
  const logs2 = await page.evaluate(() => window.causerie.loadMem().deck.log.length);
  if (logs2 !== 2) await fail('resumed session did not log: ' + logs2);
  await page.click('.rev-actions >> button:has-text("Terminé")');
  console.log('review resume after reload OK');

  /* ---- parallel languages: add Italian from the profile, switch back ---- */
  await page.click('nav >> text=Aujourd’hui');
  await page.click('.avatar-badge');
  await page.waitForSelector('h2:has-text("Profils")');
  await page.click('text=Ajouter une langue');
  await page.click('.addlang >> text=🇮🇹 Italiano');
  await page.click('.addlang >> text=B1');
  await page.click('.addlang >> button:has-text("C’est parti")');
  await page.waitForSelector('nav >> text=Oggi', { timeout: 8000 }); // whole UI now Italian
  await shot('06c-italian');
  const itState = await page.evaluate(() => {
    const m = window.causerie.loadMem();
    return { target: m.profile.target, name: m.profile.name, lvl: m.cefr.overall, cards: m.deck.cards.length };
  });
  if (itState.target !== 'it' || itState.name !== 'Marco' || itState.lvl !== 4 || itState.cards !== 0) {
    await fail('italian profile wrong: ' + JSON.stringify(itState));
  }
  await page.click('.avatar-badge');
  await page.waitForSelector('h2:has-text("Profili")');
  await page.click('.langchips >> text=🇫🇷 Français');
  await page.waitForSelector('nav >> text=Aujourd’hui', { timeout: 8000 }); // back to French, deck intact
  const backState = await page.evaluate(() => window.causerie.loadMem().deck.cards.length);
  if (backState < 12) await fail('french deck lost after language switch: ' + backState);
  console.log('parallel languages OK (fr → it → fr)');

  /* ---- seeded memory ---- */
  await page.click('nav >> text=Mémoire');
  await page.waitForSelector('text=NIVEAU (CECR)');
  await shot('07-memory-overview', true);
  await page.click('.tabs >> text=Lacunes');
  await page.waitForSelector('text=jamais + de');
  const gaps = await page.locator('.gap').count();
  if (gaps < 6) await fail('expected >=6 seeded gaps, got ' + gaps);
  await page.click('.tabs >> text=Faits');
  await page.waitForSelector('text=réserve naturelle');

  /* ---- competency matrix: seeded islands + pin a cell for the next call ---- */
  await page.click('.tabs >> text=Carte');
  await page.waitForSelector('.matrix');
  const cells = await page.evaluate(() => ({
    ok: document.querySelectorAll('.cc.ok').length,
    ko: document.querySelectorAll('.cc.ko').length,
    grey: document.querySelectorAll('.cc:not(.ok):not(.ko):not(.partial)').length
  }));
  if (cells.ok < 3 || cells.ko < 3 || cells.grey < 50) await fail('matrix cells wrong: ' + JSON.stringify(cells));
  await shot('07b-matrix', true);
  await page.click('.cc.ko');
  await page.waitForSelector('button:has-text("Travailler ça au prochain appel")');
  await page.click('button:has-text("Travailler ça au prochain appel")');
  await page.waitForSelector('text=Prévu au prochain appel');
  const pinnedOk = await page.evaluate(() => {
    const m = window.causerie.loadMem();
    const t = window.causerie.focusTargets(m, 3);
    const p = window.causerie.buildTutorPrompt(m, { topic: 'x', targets: t, minutes: 8 });
    return m.pinned.length === 1 && t[0].kind === 'comp' && p.includes('Sondage discret');
  });
  if (!pinnedOk) await fail('pinned matrix cell did not reach targets/briefing');
  console.log('competency matrix OK:', JSON.stringify(cells));

  await page.click('.tabs >> text=Briefing');
  await page.waitForSelector('pre.brief');
  const brief = await page.locator('pre.brief').innerText();
  if (!brief.includes('Odile') || !brief.includes('REFORMULATION') || !brief.includes('Faits personnels')) await fail('briefing incomplete');
  await page.click('.tabs >> text=Données');
  await page.waitForSelector('text=Export (JSON)');

  /* ---- review rendering via fixture ---- */
  await page.evaluate(() => {
    const C = window.causerie;
    const m = C.loadMem();
    const an = {
      hauptpunkt: 'Du hast das Passé composé heute dreimal richtig gebaut. Notiert.',
      kommentar: 'Solide Runde. Die Verneinung sitzt noch nicht, der Rest läuft.',
      cefr: { overall: 'A2+', grammar: 'A2', vocabulary: 'A2+', fluency: 'A2', comprehension: 'B1', confidence: 0.6, begruendung: 'Verständnis stabil, Produktion einfach, aber korrekt.' },
      corrections: [{ user_turn: 1, original: 'Je suis allé au parc hier avec mon chien.', besser: 'Je suis allé au parc hier avec mon chien. (korrekt!)', erklaerung: 'Beispiel-Tipp für das Test-Rendering.', category: 'grammar', cefr_topic: 'passé composé', cloze_text: 'Je suis ___ au parc hier.', cloze_answer: 'allé', hint: 'passé composé' }],
      highlights: [{ user_turn: 0, quote: 'Je préfère les grands arbres.', kommentar: 'Präferenz sauber ausgedrückt.' }],
      new_vocab: [{ fr: 'le sentier', de: 'der Pfad', ex: 'On suit le sentier.' }],
      weaknesses: [], strengths: [], interests: ['Parks'],
      facts: [{ text: 'Hat einen Hund', category: 'familie' }],
      targets: [{ label: 'Benutze einmal jamais mit de', achieved: false, evidence: 'Kam nicht vor.' }],
      next_focus: [{ label: 'Verneinung mit jamais + de aktiv verwenden', cefr: 'A2', grund: 'Heute wieder vermieden.' }],
      topics: ['Spaziergänge'], prune: { facts: [], interests: [] }, competencies: [], _model: 'fixture'
    };
    C.applyAnalysis(m, an, {
      topic: 'Conversation test',
      targets: [{ kind: 'weakness', id: null, label: 'Benutze einmal jamais mit de', cefr: 'A2', status: 'new' }],
      transcript: [
        { role: 'assistant', text: 'Salut Marco. Alors, ce parc?' },
        { role: 'user', text: 'Je préfère les grands arbres.' },
        { role: 'assistant', text: 'Bon choix. Et hier?' },
        { role: 'user', text: 'Je suis allé au parc hier avec mon chien.' }
      ],
      seconds: 300
    });
    C.saveMem(m);
  });
  await page.reload();
  await page.click('nav >> text=Mémoire');
  await page.click('.tabs >> text=Conversations');
  await page.click('.sess >> text=Conversation test');
  await page.waitForSelector('text=À RETENIR');
  await page.waitForSelector('text=TRÈS BIEN');
  await page.waitForSelector('text=CONSEIL');
  await page.waitForSelector('text=nouvelles cartes pour ce soir');
  await shot('08-review-fixture', true);
  const factsSaved = await page.evaluate(() => window.causerie.loadMem().facts.some(f => f.text === 'Hat einen Hund'));
  if (!factsSaved) await fail('fixture fact did not land in memory');

  /* ---- pin a correction from the review (star → card jumps the queue) ---- */
  await page.click('.note.tip >> button:has-text("Prioriser")');
  await page.waitForSelector('.note.tip >> text=En tête ce soir', { timeout: 4000 });
  const starred = await page.evaluate(() => {
    const m = window.causerie.loadMem();
    const c = m.deck.cards.find(x => x.starred);
    if (!c) return null;
    const q = window.causerie.buildSession(m.deck, m.settings.sessionSize, m.settings.newPerSession);
    return { front: c.front, first: q[0] && q[0].id === c.id };
  });
  if (!starred || !starred.first) await fail('starred correction is not leading the session: ' + JSON.stringify(starred));
  console.log('starred correction OK:', JSON.stringify(starred));

  /* ---- story player overlay: questions per paragraph appear while listening ---- */
  await page.click('nav >> text=Aujourd’hui');
  await page.waitForSelector('text=Odile propose');
  await page.evaluate(() => {
    const id = window.causerie.activeProfile()?.id ?? 'solo';
    const d = new Date().toISOString().slice(0, 10);
    localStorage.setItem('causerie.story:' + id + ':' + d, '{"title":"vieux format","text":"x"}'); // legacy v1 leftover
    const story = {
      title: 'Le chat du quai',
      text: 'Un chat dort sur le quai.\n\nUn bateau arrive ce matin.\n\nLe chat monte à bord.',
      questions: [
        { q: 'Où dort le chat ?', options: ['Sur le quai', 'Dans le bateau', 'Sous un arbre'], correct: 0 },
        { q: 'Qu’est-ce qui arrive ?', options: ['Un train', 'Un bateau', 'Un bus'], correct: 1 },
        { q: 'Que fait le chat à la fin ?', options: ['Il dort encore', 'Il part en ville', 'Il monte à bord'], correct: 2 }
      ]
    };
    localStorage.setItem('causerie.story2:' + id + ':' + d, JSON.stringify(story));
  });
  await page.reload();
  await page.waitForSelector('text=Odile propose');
  const legacyGone = await page.evaluate(() => {
    const id = window.causerie.activeProfile()?.id ?? 'solo';
    const d = new Date().toISOString().slice(0, 10);
    return localStorage.getItem('causerie.story:' + id + ':' + d) === null;
  });
  if (!legacyGone) await fail('legacy story cache entry was not cleaned up');
  // The story, the retell and the ear training live behind "Autres activités" now, so
  // the day itself fits a phone: the call and the cards.
  await page.click('button:has-text("Autres activités")');
  await page.waitForSelector('.sheet >> text=Le chat du quai'); // cached story title
  await page.click('.sheet >> button:has-text("Écouter")');
  await page.waitForSelector('.story-sheet', { timeout: 8000 });
  const dots = await page.locator('.stdots .dot').count();
  if (dots !== 3) await fail('expected 3 paragraph dots, got ' + dots);
  // Questions surface one per paragraph as playback advances (TTS through the bridge;
  // where audio can't play, speak() resolves and the reveal still walks the paragraphs).
  let qblocks = 0;
  for (let i = 0; i < 150; i++) {
    qblocks = await page.locator('.qblock').count();
    if (qblocks === 3) break;
    await page.waitForTimeout(400);
  }
  if (qblocks !== 3) await fail('expected 3 per-paragraph questions after listening, got ' + qblocks);
  await shot('09-story-questions', true);
  await page.click('.qblock >> nth=0 >> button:has-text("Sur le quai")');
  await page.waitForSelector('.verdict.ok', { timeout: 4000 });
  await page.click('.qblock >> nth=1 >> button:has-text("Un train")'); // deliberately wrong
  await page.waitForSelector('.verdict.no', { timeout: 4000 });
  await page.waitForSelector('text=c’était : Un bateau'); // the right answer is spelled out
  await page.click('.story-sheet >> button:has-text("Voir le texte")');
  await page.waitForSelector('.stpara');
  const words = await page.locator('.stword').count();
  if (words < 12) await fail('story text words are not tappable: ' + words);
  if (LIVE) {
    /* tap a word, extend to a phrase, translate in context, forge cards from it */
    await page.click('.stpara >> nth=2 >> .stword >> text=monte');
    await page.click('.stpara >> nth=2 >> .stword >> text=bord');
    let transOk = false;
    for (let i = 0; i < 75; i++) {
      const t = await page.evaluate(() => (document.querySelector('.transbox')?.textContent || ''));
      if (t.includes('monte à bord') && t.includes('→')) { transOk = true; break; }
      await page.waitForTimeout(400);
    }
    if (!transOk) await fail('tap-to-translate produced no in-context translation');
    await shot('09b-story-translate', true);
    await page.click('.transbox >> button:has-text("En faire des cartes")');
    await page.waitForSelector('.sheetveil textarea', { timeout: 5000 });
    const seedVal = await page.locator('.sheetveil textarea').inputValue();
    if (!seedVal.includes('monte à bord')) await fail('card forge not seeded with the tapped phrase: ' + seedVal);
    await page.keyboard.press('Escape'); // closes the forge only…
    await page.waitForTimeout(300);
    if (!(await page.locator('.story-sheet').count())) await fail('escape in the forge also closed the story player');
  }
  await page.click('.qblock >> nth=2 >> button:has-text("Il monte à bord")');
  await page.waitForSelector('text=2/3'); // score line once everything is answered
  await page.click('.story-sheet >> button:has-text("Fermer")');
  await page.waitForSelector('.story-sheet', { state: 'detached' });
  if (await page.locator('.sheetveil').count()) await fail('the activities sheet outlived the player it launched');
  console.log('story player OK: 3 paragraph questions, verdicts, tappable text');
  console.log('UI tests OK');

  /* ---- live: SDP contract + real analysis round-trip ---- */
  if (LIVE) {
    await page.click('nav >> text=Aujourd’hui');
    await page.waitForSelector('text=Odile propose');
    // The primary button is whichever half of the day is still owed; name the call one.
    await page.click('.daycard >> button:has-text("Appeler Odile"), .daycard >> button:has-text("Appelle Odile")');
    await page.waitForSelector('.callname', { timeout: 10000 });
    let sdp = null;
    for (let i = 0; i < 50; i++) {
      sdp = await page.evaluate(() => window.__sdpStatus || null);
      if (sdp) break;
      await page.waitForTimeout(400);
    }
    console.log('SDP exchange status:', sdp);
    if (!sdp || sdp >= 300) { await shot('06-call-sdpfail'); await fail('SDP exchange failed: ' + sdp); }
    const gotCaption = await page.waitForSelector('.cap.tutor', { timeout: 20000 }).then(() => true).catch(() => false);
    console.log('tutor caption:', gotCaption, gotCaption ? '' : '(expected false behind an HTTP proxy: no ICE/UDP path)');
    await shot('06-call');
    await page.click('.callbtn.end');
    await page.click('.endconfirm >> button:has-text("Terminer")'); // hang-up now asks first
    await page.waitForTimeout(1500);

    const anRes = await page.evaluate(async () => {
      const C = window.causerie;
      const mem = C.loadMem();
      const sess = { topic: 'Spaziergänge und Natur', mode: 'daily', targets: [{ kind: 'weakness', id: null, label: 'Benutze einmal jamais mit de', cefr: 'A2', status: 'new' }] };
      const transcript = [
        { role: 'assistant', text: 'Salut Marco. Aujourd’hui: les promenades. Ça te va, ou tu préfères autre chose ?' },
        { role: 'user', text: 'Oui, ça va. Je promène chaque jour dans la réserve naturelle avec mon chien Milo.' },
        { role: 'assistant', text: 'Tu te promènes chaque jour avec Milo. Pas mal. Tu vois des animaux ?' },
        { role: 'user', text: 'Oui, je vois des oiseaux, mais je ne sais pas les noms.' },
        { role: 'assistant', text: 'Tu ne connais pas les noms. Moi non plus, parfois. Et des arbres ?' },
        { role: 'user', text: 'Je préfère les grands arbres. Je n’ai pas jamais dessiné un arbre.' }
      ];
      const verbatim = 'oui ça va… je promène chaque jour dans la réserve naturelle avec mon chien Milo… ähm oui je vois des oiseaux mais je ne sais pas les noms… je préfère les grands arbres, je n’ai pas jamais dessiné un arbre';
      try {
        const an = await C.runAnalysis(mem, sess, transcript, verbatim);
        const validCloze = (an.corrections || []).filter(c => c.cloze_text && c.cloze_text.includes('___') && c.cloze_answer).length;
        return {
          ok: true, model: an._model, hp: an.hauptpunkt, corr: (an.corrections || []).length,
          validCloze, facts: an.facts, cefr: an.cefr && an.cefr.overall,
          sampleCloze: an.corrections && an.corrections[0] && { text: an.corrections[0].cloze_text, ans: an.corrections[0].cloze_answer }
        };
      } catch (e) {
        return { ok: false, err: String(e.message).slice(0, 300) };
      }
    });
    console.log('LIVE analysis:', JSON.stringify(anRes, null, 1).slice(0, 900));
    if (!anRes.ok) await fail('live analysis failed: ' + anRes.err);
    if (!anRes.validCloze) await fail('no valid cloze card material in live analysis');
    if (!Array.isArray(anRes.facts) || !anRes.facts.length) await fail('no facts extracted from a transcript that contains one');

    /* ---- LIVE card image pipeline: two prompt ideas, then one real image ---- */
    const imgRes = await page.evaluate(async () => {
      const C = window.causerie;
      const mem = C.loadMem();
      const card = mem.deck.cards[0];
      try {
        const ideas = await C.suggestPrompts(card, mem);
        if (!ideas || !ideas.a || !ideas.b) return { ok: false, err: 'no ideas: ' + JSON.stringify(ideas) };
        const img = await C.generateImage(ideas.a);
        return { ok: true, a: ideas.a, b: ideas.b, imgBytes: img.length, isData: img.startsWith('data:image/') };
      } catch (e) { return { ok: false, err: String(e.message).slice(0, 300) }; }
    });
    console.log('LIVE card image:', JSON.stringify({ ...imgRes, imgBytes: imgRes.imgBytes }, null, 1).slice(0, 600));
    if (!imgRes.ok) await fail('live image pipeline failed: ' + imgRes.err);
    if (!imgRes.isData || imgRes.imgBytes < 20000) await fail('generated image looks wrong');

    /* ---- LIVE card forge: a term becomes three complementary proposals ---- */
    const forged = await page.evaluate(async () => {
      const C = window.causerie;
      try {
        const props = await C.suggestCards('toboggan — was heißt das?', C.loadMem());
        return { ok: true, n: props.length, types: props.map(p => p.type), hasCloze: props.some(p => p.type === 'cloze' && p.front.includes('___')) };
      } catch (e) { return { ok: false, err: String(e.message).slice(0, 200) }; }
    });
    console.log('LIVE card forge:', JSON.stringify(forged));
    if (!forged.ok || forged.n < 2 || !forged.hasCloze) await fail('card forge failed: ' + JSON.stringify(forged));

    /* ---- LIVE story generation: one comprehension question per paragraph ---- */
    const st = await page.evaluate(async () => {
      const C = window.causerie;
      try {
        const s = await C.makeStory(C.loadMem(), true);
        return {
          ok: true, title: s.title, nParas: C.storyParas(s.text).length,
          nQs: (s.questions || []).length,
          opts3: (s.questions || []).every(q => q.options.length === 3 && q.correct >= 0 && q.correct <= 2)
        };
      } catch (e) { return { ok: false, err: String(e.message).slice(0, 200) }; }
    });
    console.log('LIVE story:', JSON.stringify(st));
    if (!st.ok) await fail('live story failed: ' + st.err);
    if (st.nParas < 2 || st.nQs !== st.nParas || !st.opts3) await fail('story does not carry one question per paragraph: ' + JSON.stringify(st));
    console.log('LIVE tests OK');
  }
  console.log('ALL OK');
} catch (e) {
  await fail(e.message);
} finally {
  await browser.close().catch(() => {});
  cleanup();
}
process.exit(0);
