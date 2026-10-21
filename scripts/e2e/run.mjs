#!/usr/bin/env node
/**
 * Harnais end-to-end (PLAN.md §12.11).
 *
 * Cette version est un simple garde-fou : le pilote CDP sur un vrai Google
 * Chrome arrive à l'étape C7 du plan. En attendant, `npm run e2e` n'a rien
 * à lancer et le dit clairement.
 */
console.error(
  'Le harnais end-to-end n’est pas encore écrit : il arrive à l’étape C7 du plan (PLAN.md §12.7).\n' +
    'D’ici là, les vérifications sont `npm test`, `npm run typecheck` et `npm run build`.',
);
process.exit(1);
