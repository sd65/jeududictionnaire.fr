#!/usr/bin/env node
/**
 * Étape 1 du pipeline dictionnaire : filtrer Lexique383 pour produire la
 * liste des mots rares candidats.
 *
 * Entrée : data/Lexique383.tsv (téléchargé au préalable via curl)
 * Sortie : data/candidates.json
 *
 * Critères (réglables en ligne de commande) :
 *   - uniquement des lemmes (colonne islem)
 *   - catégories grammaticales NOM / ADJ / VER (--cats)
 *   - tout en minuscules (pas de noms propres), lettres accentuées + tiret
 *   - longueur entre minLen et maxLen
 *   - rare : fréquence du lemme <= maxFreq par million, dans les DEUX
 *     corpus (freqlemlivres ET freqlemfilms2)
 *
 * Usage : node scripts/build-candidates.mjs [--maxFreq 0.3] [--maxWords 30000]
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { statSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const argNum = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(argv[i + 1]) : NaN;
  return Number.isFinite(v) ? v : def;
};
const argStr = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};

const TSV_PATH = 'data/Lexique383.tsv';
const OUT = 'data/candidates.json';
const MAX_FREQ = argNum('maxFreq', 0.3); // par million
const MIN_LEN = argNum('minLen', 7);
const MAX_LEN = argNum('maxLen', 14);
const MAX_WORDS = argNum('maxWords', 30000);
const CATS = argStr('cats', 'NOM,ADJ,VER').split(',');

const ALLOWED = /^[a-zàâäçéèêëîïôöùûüœæ-]+$/;

const posLabel = (cgram, genre) => {
  if (cgram === 'ADJ') return 'adj.';
  if (cgram === 'VER') return 'v.';
  if (cgram === 'ADV') return 'adv.';
  if (cgram === 'NOM') {
    if (genre === 'm') return 'n.m.';
    if (genre === 'f') return 'n.f.';
    if (genre.includes('m') && genre.includes('f')) return 'n.m./f.';
    return 'n.';
  }
  return cgram.toLowerCase();
};

const stats = { rows: 0, lemmes: 0, bonneCat: 0, bonneForme: 0, rare: 0, uniques: 0 };

const byWord = new Map(); // ortho -> candidat

const rl = createInterface({ input: createReadStream(TSV_PATH, 'utf8'), crlfDelay: Infinity });

let headerDone = false;
let idx = {};
let linesRead = 0;
const PROGRESS_EVERY = 200000;

rl.on('line', (line) => {
  if (!headerDone) {
    idx = Object.fromEntries(line.split('\t').map((h, i) => [h, i]));
    headerDone = true;
    return;
  }
  linesRead++;
  stats.rows++;
  const c = line.split('\t');
  if (c.length < 10) return;
  const ortho = c[idx.ortho] || '';
  if (!ortho) return;

  const islem = c[idx.islem] || '';
  const isLemma = islem !== '0' && islem !== 'false' && islem !== '';
  if (!isLemma) return;
  stats.lemmes++;

  const cgram = c[idx.cgram] || '';
  if (!CATS.includes(cgram)) return;
  stats.bonneCat++;

  if (ortho !== ortho.toLowerCase() || /[A-ZÀ-Þ]/.test(ortho)) return; // noms propres exclus
  if (ortho.length < MIN_LEN || ortho.length > MAX_LEN) return;
  if (!ALLOWED.test(ortho)) return;
  if ((ortho.match(/-/g) || []).length > 1) return;
  stats.bonneForme++;

  const fL = parseFloat(c[idx.freqlemlivres] || '0') || 0;   // fréq. lemme, corpus livres
  const fF = parseFloat(c[idx.freqlemfilms2] || '0') || 0;   // fréq. lemme, corpus films
  const fFormL = parseFloat(c[idx.freqlivres] || '0') || 0;  // fréq. forme, tous corpus
  const fFormF = parseFloat(c[idx.freqfilms2] || '0') || 0;
  if (fL > MAX_FREQ || fF > MAX_FREQ) return;
  if (fFormL <= 0 && fFormF <= 0) return; // jamais attesté : probable coquille
  stats.rare++;

  const cand = { w: ortho, p: posLabel(cgram, c[idx.genre] || ''), fL, fF };
  const prev = byWord.get(ortho);
  if (!prev) byWord.set(ortho, cand);
  else if (fL + fF > prev.fL + prev.fF) byWord.set(ortho, cand); // homonyme : garder le plus attesté

  if (linesRead % PROGRESS_EVERY === 0) {
    console.log(`… ${linesRead} lignes lues, ${byWord.size} candidats uniques`);
  }
});

rl.on('close', () => {
  stats.uniques = byWord.size;
  // Tri par rareté croissante ; les livres sont la source la plus riche en
  // vocabulaire rare, donc on pondère légèrement en leur faveur.
  const all = [...byWord.values()]
    .sort((a, b) => (a.fL * 1.4 + a.fF) - (b.fL * 1.4 + b.fF) || a.w.localeCompare(b.w));
  const kept = all.slice(0, MAX_WORDS);
  const out = {
    meta: {
      generated: new Date().toISOString(),
      source: `Lexique 383 (lexique.org) — lemmes ${CATS.join('/')} freq≤${MAX_FREQ}/M`,
      args: { MAX_FREQ, MIN_LEN, MAX_LEN, MAX_WORDS, CATS },
      stats: { ...stats, ecartésRedondants: all.length - kept.length },
    },
    words: kept.map(({ w, p, fL, fF }) => ({ w, p, fL: round4(fL), fF: round4(fF) })),
  };
  writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');

  console.log('\n=== RÉSULTAT ===');
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(13)}: ${v}`);
  console.log(`  écrits        : ${kept.length} mots → ${OUT} (${(statSync(OUT).size / 1024).toFixed(0)} Ko)`);
  // Quelques échantillons pour contrôle visuel
  const sample = kept.filter((_, i) => i % Math.max(1, Math.floor(kept.length / 12)) === 0).slice(0, 12);
  console.log('  échantillon   :', sample.map(x => x.w).join(', '));
});

const round4 = (x) => Math.round(x * 1e4) / 1e4;
