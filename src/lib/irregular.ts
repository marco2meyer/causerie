/** Words whose forms do not look like the word.
 *
 *  A word goal is matched by stem: the learner says "travaille", the deck holds
 *  "travailler", and the shared beginning is what ties them together (lib/utils stemsMatch).
 *  That covers most of a conjugation and all of a plural, and it cannot possibly cover the
 *  handful of verbs in every language whose stem is replaced rather than extended. "Aller"
 *  shares nothing with "vais". "Be" shares nothing with "was". No prefix rule will ever
 *  connect them, so they are simply listed.
 *
 *  Two rules keep this table from growing into a conjugator:
 *
 *  1. Nothing is listed that the stem rule already reaches. Every entry here was checked
 *     against stemsMatch when the table was written and kept only if it FAILED — about a
 *     third of the first draft went out that way ("allons" is reachable from "aller",
 *     "children" from "child"). A test re-checks it, so the table shrinks by itself if the
 *     stem rule is ever widened again.
 *  2. Nothing is listed that folds onto a word which is not this verb. Accents and case are
 *     gone by the time a form gets here, so French "a" is indistinguishable from "à" and
 *     Italian "è" from "e" — listing them would tick "avoir" on every "je vais à Berlin".
 *     Those forms are dropped and the goal simply misses them, which is the cheaper error.
 *
 *  The forms are stored already normalised, because that is how they are looked up.
 */
import type { LangCode } from '../types';
import { norm } from './utils';

const TABLES: Partial<Record<LangCode, Record<string, string>>> = {
  /* French */
  fr: {
    'aller': 'vais vas va vont irai iras ira irons irez iront irais irait aille ailles aillent',
    'asseoir': 'assieds assied asseyons asseyez asseyent assois assoit assoient assise',
    'avoir': 'ai as avez ont avais avait avaient eu eus eut eurent aurai aura aurons auront aurais aurait aie ait aient ayant',
    'boire': 'buvons buvez bu but burent',
    'connaitre': 'connaissons connaissez connaissent connu connut connaisse',
    'croire': 'croyons croyez cru crut',
    'devoir': 'dois doit doivent devrai devrais devrait doive dus dut durent',
    'dire': 'dis dit disons dites disent dise',
    'etre': 'suis es est sommes etes sont etais etait etions etiez etaient fus fut furent serai seras sera serons serez seront serais serait soit soient ete',
    'faire': 'font ferai feras fera ferons feront ferais ferait fasse fasses fassent fis fit firent',
    'falloir': 'faut faudra faudrait faille',
    'lire': 'lis lit lisons lisez lisent lu lut lurent lise',
    'mettre': 'met mis mise mit mirent',
    'mourir': 'meurs meurt meurent mort morte morts meure',
    'naitre': 'naissons naissez naissent nee nes naquit',
    'oeil': 'yeux',
    'pleuvoir': 'pleut pleuvrait plu',
    'pouvoir': 'peux peut peuvent pourrai pourra pourrons pourront pourrais pourrait puisse puissent pu put purent',
    'prendre': 'prenons prennent pris prise prises prit prirent',
    'recevoir': 'recois recoit recoivent recevrai recevrait recu recut recoive',
    'savoir': 'sais sait savent saurai saura saurais saurait sache sachent su sut surent',
    'tenir': 'tiens tient tiennent tiendrai tiendrait tienne tins tint',
    'valoir': 'vaux vaut valent vaudra vaudrait vaille',
    'venir': 'viens vient viennent viendrai viendra viendrais viendrait vienne vins vint vinrent',
    'vivre': 'vis vit vecu vecut',
    'voir': 'voyons voyez verrai verra verrons verront verrais verrait vu vit virent',
    'vouloir': 'veux veut veulent voudrai voudra voudrais voudrait veuille veuillent',
  },
  /* Spanish */
  es: {
    'dar': 'doy das damos dais dan dio dimos dieron daria den dado',
    'decir': 'digo dices dice dicen dije dijo dijimos dijeron dire diria diga digan dicho',
    'estar': 'estuvimos estuvieron',
    'haber': 'has hemos han hubo hubieron haya hayan',
    'hacer': 'hago hice hizo hicimos hicieron hare haria haga hagan hecho',
    'ir': 'voy vas va vamos vais van iba ibas ibamos iban fui fue fuimos fueron ire ira iria vaya vayas vayan yendo',
    'oir': 'oigo oyes oye oimos ois oyen oi oyo oyeron oiga oigan oido',
    'poder': 'puedo puedes puede pueden pude pudo pudimos pudieron pueda puedan',
    'poner': 'puse puso pusimos pusieron puesto',
    'querer': 'quiero quieres quiere quieren quise quiso quisimos quisieron quiera quieran',
    'saber': 'supe supo supimos supieron sepa sepan',
    'ser': 'soy eres somos sois son era eras eramos eran fui fue fuimos fueron seremos seran seria sea seas sean siendo sido',
    'tener': 'tienes tiene tienen tuve tuvo tuvimos tuvieron',
    'traer': 'trajimos trajeron',
    'venir': 'vienes viene vienen vine vino vinimos vinieron',
    'ver': 'veo ves ve vemos veis ven vi vio vimos vieron veria vea vean visto viendo',
  },
  /* Italian */
  it: {
    'andare': 'vado vai va andiamo vanno andrei andrebbe vada vadano',
    'avere': 'ho hai ha abbiamo hanno ebbi ebbe ebbero avro avra avrei avrebbe abbia abbiano avuto',
    'bere': 'bevo bevi beve beviamo bevete bevono bevvi bevve bevvero berrebbe beva bevano bevuto',
    'dare': 'diamo danno diedi diede diedero darebbe dia diano dato',
    'dire': 'dico dici dice diciamo dite dicono dissi disse dissero direbbe dica dicano detto',
    'dovere': 'devo devi deve dobbiamo devono dovrei dovrebbe debba debbano dovuto',
    'essere': 'sono sei siamo siete era eri eravamo erano fui fu fummo furono saro sara saremo saranno sarei sarebbe sia siano stato stata stati',
    'fare': 'faccio fai facciamo fate fanno feci fece fecero farebbe faccia facciano fatto',
    'potere': 'posso puoi puo possiamo possono potrei potrebbe possa possano potuto',
    'rimanere': 'rimaniamo rimangono rimasero rimarro rimarrei rimasto',
    'sapere': 'so sai sa sappiamo sanno seppi seppe seppero saprei saprebbe sappia sappiano saputo',
    'stare': 'sto stiamo stetti stette stettero stia stiano',
    'uscire': 'esco esci esce escono esca escano',
    'venire': 'vieni viene vengono vennero verro verra verrei verrebbe vengano venuto',
    'volere': 'voglio vuoi vuole vogliamo vogliono vollero vorro vorra vorrei vorrebbe voglia vogliano voluto',
  },
  /* Portuguese */
  pt: {
    'dar': 'dou das damos dais dao dei deu demos deram darei daria deem dado',
    'dizer': 'digo diz disse dissemos disseram direi diria diga digam dito',
    'estar': 'estivemos estiveram',
    'fazer': 'faco faz fiz fez fizemos fizeram farei faria faca facam feito',
    'haver': 'hei has hao houve houveram haja hajam',
    'ir': 'vou vais vai ides vao ias iamos iam fui foi fomos foram irei iria va indo ido',
    'poder': 'posso pude pudemos puderam possa possam',
    'por': 'ponho poes poe pomos pondes poem pus pos pusemos puseram porei poria ponha ponham posto',
    'querer': 'quis quisemos quiseram queira queiram',
    'ser': 'sou es somos sois sao era eras eramos eram fui foi fomos foram serei seremos serao seria seja sejam sendo sido',
    'ter': 'tenho tens tem temos tendes tinha tinhas tinhamos tinham tive teve tivemos tiveram terei teria tenha tenham tido',
    'trazer': 'trouxe trouxemos trouxeram trarei traria tragam',
    'ver': 'vejo ves ve vemos vedes veem vi viu vimos viram verei veria veja vejam visto vendo',
    'vir': 'venho vens vem vimos vindes vim veio viemos vieram virei viria venha venham vindo',
  },
  /* English */
  en: {
    'be': 'am is are was were been being',
    'become': 'became',
    'break': 'broke broken',
    'bring': 'brought',
    'buy': 'bought',
    'catch': 'caught',
    'choose': 'chosen',
    'come': 'came',
    'do': 'does did done',
    'drink': 'drank drunk',
    'eat': 'ate eaten',
    'feel': 'felt',
    'find': 'found',
    'fly': 'flew flown flies',
    'foot': 'feet',
    'get': 'got gotten',
    'give': 'gave',
    'go': 'went gone goes',
    'have': 'has had',
    'know': 'knew',
    'leave': 'left',
    'life': 'lives',
    'make': 'made',
    'man': 'men',
    'mouse': 'mice',
    'person': 'people',
    'run': 'ran',
    'say': 'said',
    'see': 'saw',
    'sell': 'sold',
    'speak': 'spoke spoken',
    'stand': 'stood',
    'swim': 'swam swum',
    'take': 'took',
    'teach': 'taught',
    'tell': 'told',
    'think': 'thought',
    'tooth': 'teeth',
    'understand': 'understood',
    'wife': 'wives',
    'write': 'wrote',
  },
};

/** Cached split of the stored space-separated form lists. */
const cache = new Map<string, string[]>();

/** The forms of `lemma` in `lang` that no stem rule could reach, already normalised.
 *  Empty for every word that does not need the list, which is nearly all of them. */
export function irregularForms(lemma: string, lang: string | undefined): string[] {
  if (!lang) return [];
  const table = TABLES[lang as LangCode];
  if (!table) return [];
  const key = norm(lemma);
  const raw = table[key];
  if (!raw) return [];
  let forms = cache.get(lang + '|' + key);
  if (!forms) cache.set(lang + '|' + key, (forms = raw.split(' ')));
  return forms;
}

/** Every lemma the table knows for a language. Used by the tests that keep it honest. */
export function irregularLemmas(lang: string): string[] {
  return Object.keys(TABLES[lang as LangCode] ?? {});
}
