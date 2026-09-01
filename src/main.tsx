import { render } from 'preact';
import { App } from './app';
// Self-hosted fonts (bundled woff2): no render-blocking third-party request,
// no silent hang on networks that filter Google Fonts.
import '@fontsource-variable/figtree';
import '@fontsource-variable/bricolage-grotesque';
import './styles/global.css';

/* Debug/test API (used by the e2e suite and handy in the console). */
import { blankMem, loadMem, saveMem } from './lib/storage';
import { seedMem } from './lib/seed';
import { applyAnalysis } from './lib/merge';
import { runAnalysis } from './lib/analysis';
import { buildTutorPrompt } from './lib/prompts';
import { focusTargets } from './lib/focus';
import { buildSession, dueCounts } from './lib/srs';
import { listProfiles, activeProfile } from './lib/profiles';
import { generateImage, suggestPrompts } from './lib/imagegen';
import { forgeToCards, suggestCards } from './lib/forge';
import { makeStory, paras } from './lib/story';

window.causerie = {
  loadMem, saveMem, blankMem, seedMem, applyAnalysis, runAnalysis,
  buildTutorPrompt, focusTargets, buildSession, dueCounts, listProfiles, activeProfile,
  suggestPrompts, generateImage, suggestCards, forgeToCards, makeStory, storyParas: paras
};

render(<App />, document.getElementById('app')!);
