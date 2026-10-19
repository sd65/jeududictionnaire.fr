#!/usr/bin/env node
/**
 * Étape 2 du pipeline : récupérer la vraie définition de chaque mot
 * candidat sur le Wiktionnaire (API MediaWiki, requêtes par lots de 50).
 *
 * Entrée : data/candidates.json
 * Sorties :
 *   - data/defs.jsonl   (résultats bruts, lot par lot → reprise possible)
 *   - data/wordlist.json (pack final : mots avec définition, triés du plus
 *     rare au plus courant)
 *   - data/no-definition.txt (candidats sans page/définition exploitable)
 *
 * Usage : node scripts/fetch-definitions.mjs [--limit 200] [--batch 50] [--sleep 500]
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, statSync } from 'node:fs';

const argv = process.argv.slice(2);
const argNum = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(argv[i + 1]) : NaN;
  return Number.isFinite(v) ? v : def;
};

const BATCH = argNum('batch', 50);
const LIMIT = argNum('limit', 0); // 0 = tous
const SLEEP_MS = argNum('sleep', 500);
const CANDS = 'data/candidates.json';
const RAW = 'data/defs.jsonl';
const OUT = 'data/wordlist.json';

const UA = 'jeududictionnaire-build/0.1 (jeu local sur réseau LAN)';

/* ------------------- parsing du wikitext ------------------- */

const cleanWikitext = (raw) => {
  let t = raw;
  t = t.replace(/<ref[^>]*\/>/g, '');            // <ref name="x" />
  t = t.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, ''); // <ref>…</ref>
  t = t.replace(/<[^>]+>/g, '');                 // autres balises HTML
  let guard = 8;
  while (guard-- > 0 && t.includes('{{')) t = t.replace(/\{\{[^{}]*\}\}/g, '');
  t = t.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2');
  t = t.replace(/\[\[([^\]]+)\]\]/g, '$1');
  t = t.replace(/'''?/g, '');
  t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t;
};

/** Renvoie {def, sec} ou null, à partir du wikitext d'une page du Wiktionnaire. */
export function parseFrenchDefinition(wikitext) {
  if (!wikitext) return null;
  const lines = wikitext.split('\n');

  // 1) repérer la section française
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^==\s*\{\{langue\|fr\}\}\s*==\s*$/.test(lines[i])) { start = i + 1; break; }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (/^==\s*[^=]/.test(lines[i])) { end = i; break; }
  }
  const fr = lines.slice(start, end);

  // 2) récolter les sections grammaticales === {{S|nom|fr}} === etc.
  const secRe = /^===\s*\{\{S\|([^|}]+)\|fr/;
  const prefer = ['verbe', 'nom', 'adjectif', 'adverbe'];
  const sections = [];
  for (let i = 0; i < fr.length; i++) {
    const m = fr[i].match(secRe);
    if (!m) continue;
    let j = -1;
    for (let k = i + 1; k < fr.length; k++) {
      if (/^===\s*\{\{S\|/.test(fr[k])) { j = k; break; }
    }
    sections.push({ name: m[1], body: fr.slice(i + 1, j < 0 ? fr.length : j) });
  }
  sections.sort((a, b) => prefIdx(a.name) - prefIdx(b.name));
  function prefIdx(name) {
    const i = prefer.indexOf(name);
    return i < 0 ? 99 : i;
  }

  // 3) dans chaque section (puis en repli dans toute la partie française),
  //    prendre la première ligne "# " de qualité
  const isDefLine = (l) => /^#\s/.test(l) && !/^#[:*]/.test(l);
  const pools = sections.map((s) => s.body);
  pools.push(fr);
  for (const body of pools) {
    const defs = body
      .filter(isDefLine)
      .map((l) => l.replace(/^#+\s*/, ''))
      .map((raw) => ({ raw, txt: cleanWikitext(raw) }))
      .filter((d) => d.txt.length >= 8)
      .filter((d) => !/^(variante|lexie|voir|à consulter|synonyme)/i.test(d.txt))
      .filter((d) => !/manquante|incomplète|à détruire/i.test(d.txt))
      .filter((d) => !/\{\{|\[\[/.test(d.txt)); // nettoyage raté → on saute
    for (const d of defs) {
      if (d.txt.length >= 22) return { def: d.txt };
    }
    if (defs.length) return { def: defs[0].txt };
  }
  return null;
}

/* ------------------- API ------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function queryBatch(words) {
  const url = new URL('https://fr.wiktionary.org/w/api.php');
  const p = url.searchParams;
  p.set('action', 'query');
  p.set('format', 'json');
  p.set('formatversion', '2');
  p.set('prop', 'revisions');
  p.set('rvprop', 'content');
  p.set('rvslots', 'main');
  p.set('redirects', '1');
  p.set('maxlag', '3');
  p.set('titles', words.join('|'));
  let attempt = 0;
  while (true) {
    attempt++;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 503 || res.status === 429) {
      const wait = (Number(res.headers.get('retry-after')) || 3) * 1000 + 1000;
      console.log(`  (pausse ${wait / 1000}s : API occupée, code ${res.status})`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      if (attempt < 4) { await sleep(2000 * attempt); continue; }
      throw new Error(`HTTP ${res.status} sur le lot « ${words[0]}… »`);
    }
    return res.json();
  }
}

/**
 * La requête peut normaliser les titres (majuscule, redirect).
 * On remet chaque page en face du mot demandé.
 */
function mapResultToWords(words, json) {
  const q = json?.query ?? {};
  const norm = new Map((q.normalized ?? []).map((n) => [n.from, n.to]));
  const redir = new Map((q.redirects ?? []).map((n) => [n.from, n.to]));
  const pages = q.pages ?? [];
  const out = new Map();
  for (const w of words) {
    const step1 = norm.get(w) ?? w;
    const key = redir.get(step1) ?? step1;
    let page = pages.find((pt) => pt.title === key);
    if (!page) page = pages.find((pt) => pt.title.toLowerCase() === w.toLowerCase());
    if (!page) { out.set(w, null); continue; }
    if (page.missing) { out.set(w, { missing: true }); continue; }
    const content = page?.revisions?.[0]?.slots?.main?.content ?? null;
    out.set(w, { wikitext: content });
  }
  return out;
}

/* ------------------- principal ------------------- */

const cands = JSON.parse(readFileSync(CANDS, 'utf8'));
let words = cands.words;
if (LIMIT > 0) words = words.slice(0, LIMIT);

// reprise : mots déjà traités dans defs.jsonl
const done = new Set();
if (existsSync(RAW)) {
  for (const line of readFileSync(RAW, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { done.add(JSON.parse(line).w); } catch { /* ligne tronquée : ignorée */ }
  }
}
const todo = words.filter((w) => !done.has(w.w));
console.log(`${cands.words.length} candidats au total, ${todo.length} restants à traiter (lots de ${BATCH}).`);

const t0 = Date.now();
let found = 0;
let processed = 0;
const batches = [];
for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));

for (let b = 0; b < batches.length; b++) {
  const batchWords = batches[b].map((x) => x.w);
  let json;
  try {
    json = await queryBatch(batchWords);
  } catch (e) {
    console.log(`  ! lot ${b + 1} abandonné : ${e.message}`);
    await sleep(3000);
    continue;
  }
  const mapped = mapResultToWords(batchWords, json);
  const lines = [];
  for (const cand of batches[b]) {
    const page = mapped.get(cand.w);
    let def = null;
    if (page && !page.missing) {
      const parsed = parseFrenchDefinition(page.wikitext);
      if (parsed) def = parsed.def;
    }
    if (def) found++;
    lines.push({ w: cand.w, def });
  }
  appendFileSync(RAW, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
  processed += batchWords.length;
  if ((b + 1) % 10 === 0 || b === batches.length - 1) {
    const rate = processed / Math.max(1, (Date.now() - t0) / 1000);
    const remainSec = (todo.length - processed) / Math.max(0.01, rate);
    console.log(
      `  lot ${b + 1}/${batches.length}  traités=${processed}/${todo.length}` +
      `  définis=${found}  ${rate.toFixed(1)} mots/s  reste≈` +
      (remainSec > 120 ? `${(remainSec / 60).toFixed(0)} min` : `${remainSec.toFixed(0)} s`)
    );
  }
  await sleep(SLEEP_MS);
}

/* ------------------- assemblage final ------------------- */

const defMap = new Map();
if (existsSync(RAW)) {
  for (const line of readFileSync(RAW, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const o = JSON.parse(line); defMap.set(o.w, o.def); } catch { }
  }
}
// nettoyage de fin de définition (déchets de gabarits Wiki en fin de phrase)
const cleanTail = (s) => {
  let t = s.replace(/\s+/g, ' ').trim();
  while (/[.,;:\s]$/.test(t)) t = t.replace(/[\s.,;:]+$/, '');
  return t.trim();
};
const withDef = [];
const noDef = [];
// définitions non jouables : formes fléchies driblées au rang de lemmes
const FLEXION = /^(participe présent|participe passé|passé simple|impératif|conditionnel|gerundif|gerondif|pluriel de|féminin de|masculin de|singulier de|forme de|inflexion de)/i;
for (const cand of words) {
  const def = defMap.get(cand.w);
  if (def && !FLEXION.test(def)) withDef.push({ w: cand.w, p: cand.p, d: cleanTail(def), fL: cand.fL, fF: cand.fF });
  else noDef.push(cand.w);
}
withDef.sort((a, b) => (a.fL * 1.4 + a.fF) - (b.fL * 1.4 + b.fF) || a.w.localeCompare(b.w));

const out = {
  meta: {
    generated: new Date().toISOString(),
    source: 'Lexique 383 (fréquences) + Wiktionnaire fr (définitions, CC BY-SA 4.0)',
    counts: { candidats: words.length, definis: withDef.length, sansDefinition: noDef.length },
  },
  words: withDef,
};
writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');
writeFileSync('data/no-definition.txt', noDef.join('\n') + '\n', 'utf8');

console.log(`\n=== TERMINÉ (${((Date.now() - t0) / 60000).toFixed(1)} min) ===`);
console.log(`  mots avec définition : ${withDef.length}`);
console.log(`  sans définition      : ${noDef.length} → data/no-definition.txt`);
console.log(`  pack écrit → ${OUT} (${(statSync(OUT).size / 1024).toFixed(0)} Ko)`);
