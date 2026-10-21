/**
 * Un joueur du harnais : une page, un pseudo.
 *
 * Le harnais ne gratte jamais le DOM : il lit la phase et les données dans
 * `window.__jdd` (le crochet de débogage, §6.6), et il agit par les libellés
 * français des boutons et des champs (§12.11).
 */
export class Player {
  /** @param {import('chrome.mjs').Page} page */
  constructor(page, name, options = {}) {
    this.page = page;
    this.name = name;
    /** Les choix de ce joueur, pour vérifier les points (§5). */
    this.votes = [];
    /** Faut-il photographier les écrans ? (le thème, étape E6) */
    this.shots = options.shots ?? false;
  }

  /** Une capture d'écran, pour regarder le thème (§12.9, étape E6). */
  async shot(name) {
    if (!this.shots) return null;
    const { mkdir } = await import('node:fs/promises');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const dir = join(root, 'dist', 'e2e');
    await mkdir(dir, { recursive: true });
    // On laisse le fondu d'arrivée se terminer.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return this.page.screenshot(join(dir, `${name}.png`));
  }

  /** La projection courante du joueur. */
  async view() {
    return this.page.evaluate('window.__jdd ?? null');
  }

  /** La phase du joueur. */
  async phase() {
    const view = await this.view();
    return view ? view.phase : null;
  }

  /** Attend une phase. */
  async waitForPhase(phase, timeout = 30000) {
    await this.page.waitFor(`window.__jdd && window.__jdd.phase === ${JSON.stringify(phase)}`, {
      timeout,
      label: `la phase ${phase} de ${this.name}`,
    });
  }

  /**
   * Attend une condition sur la projection.
   *
   * L'expression est évaluée avec `v` = la projection du joueur :
   * `v.phase === 'VOTE'`, `v.voters === 2', etc.
   */
  async waitForView(expression, { timeout = 30000, label = expression } = {}) {
    return this.page.waitFor(
      `(() => { const v = window.__jdd; if (!v) return false; return !!(${expression}); })()`,
      { timeout, label: `${label} (${this.name})` },
    );
  }

  /** Presse un bouton, en attendant qu'il soit là. */
  async press(label, options = {}) {
    await this.page.clickLabelWhenReady(label, options);
  }

  /** Écrit dans un champ, trouvé par son étiquette visible. */
  async type(label, text) {
    await this.page.fill(label, text);
  }

  /**
   * L'option du bulletin sur laquelle ce joueur vote.
   *
   * Jamais la sienne : elle est grisée (§3 VOTE). Le harnais lit `myIdx`
   * dans le crochet, et prend la première option qui n'est pas la sienne.
   */
  async voteOption() {
    const view = await this.view();
    if (!view) throw new Error(`${this.name} : pas de projection`);
    const own = view.myIdx;
    const count = view.optionsCount;
    let index = 0;
    while (index === own) index += 1;
    if (index >= count) throw new Error(`${this.name} : aucune option à voter`);
    this.votes.push(index);
    await this.press(`${index + 1}.`);
    return index;
  }
}
