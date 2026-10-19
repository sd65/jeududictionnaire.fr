#!/usr/bin/env node
/** Aperçu visuel du pack final (data/wordlist.json). Usage : node scripts/preview.mjs [n=15] */
import { readFileSync } from 'node:fs';
const n = Number(process.argv[2] || '') || 15;
const data = JSON.parse(readFileSync('data/wordlist.json', 'utf8'));
console.log(`Pack : ${data.words.length} mots (source : ${data.meta.source})\n`);
for (const x of shuffle(data.words).slice(0, n)) {
  console.log(`  ${x.w}  (${x.p})`);
  console.log(`    « ${x.d} »`);
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
