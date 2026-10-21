/**
 * Le pilote : un vrai Google Chrome, piloté au Chrome DevTools Protocol.
 *
 * Jamais Chromium, jamais Firefox : le harnais lance **Google Chrome** lui-même
 * (PLAN.md §12.11). Il ne touche jamais au profil de l'utilisateur : il
 * travaille dans un répertoire jetable.
 *
 * Trois joueurs = trois contextes isolés (`Target.createBrowserContext`) :
 * chacun son stockage, chacun sa fenêtre visible.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { connect, waitUntil } from './cdp.mjs';

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
];

/** Les drapeaux : un profil jetable, et le mDNS désactivé. */
const CHROME_FLAGS = [
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  // Sans cela, les trois contextes, sur la même machine, se masquent derrière
  // le même nom mDNS et l'appariement ICE entre eux casse.
  '--disable-features=WebRtcHideLocalIpsWithMdns',
];

async function findChrome() {
  const { access } = await import('node:fs/promises');
  for (const path of CHROME_PATHS) {
    try {
      await access(path);
      return path;
    } catch {
      // On essaie le suivant.
    }
  }
  throw new Error(
    'Google Chrome est introuvable. Le harnais pilote un vrai Google Chrome, jamais Chromium.',
  );
}

/** Le port et le chemin de débogage, écrits par Chrome dans son profil. */
async function devToolsEndpoint(userDataDir) {
  const file = join(userDataDir, 'DevToolsActivePort');
  return waitUntil(
    async () => {
      try {
        const content = await readFile(file, 'utf8');
        const [port, path] = content.split('\n');
        if (!port || !path) return null;
        return `ws://127.0.0.1:${port.trim()}${path.trim()}`;
      } catch {
        return null;
      }
    },
    { timeout: 20000, label: 'le port de débogage de Chrome' },
  );
}

export class Page {
  constructor(browser, sessionId, targetId) {
    this.browser = browser;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this.consoleErrors = [];
    this.failedRequests = [];
  }

  send(method, params) {
    return this.browser.client.send(method, params, this.sessionId);
  }

  /** Évalue une expression (ou une fonction) dans la page. */
  async evaluate(fn, ...args) {
    const expression =
      typeof fn === 'function'
        ? `(${fn.toString()})(${args.map((arg) => JSON.stringify(arg)).join(',')})`
        : fn;
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`Erreur dans la page : ${detail}`);
    }
    return result.result.value;
  }

  /** Clique un bouton par son libellé — jamais en grattant le DOM (§12.11). */
  async clickLabel(label) {
    const clicked = await this.evaluate((text) => {
      const nodes = [
        ...document.querySelectorAll('button, a, [role="button"], input[type="submit"]'),
      ];
      const target = nodes.find((node) => (node.textContent ?? '').trim() === text);
      if (!target) return false;
      target.click();
      return true;
    }, label);
    if (!clicked) throw new Error(`Bouton introuvable : « ${label} »`);
  }

  /**
   * Un bouton portant ce libellé est-il là ?
   *
   * Comme le clic, la recherche se fait par le texte que le joueur voit :
   * le harnais ne gratte jamais le DOM (§12.11).
   */
  async hasLabel(label) {
    return this.evaluate((text) => {
      const nodes = [...document.querySelectorAll('button, a, [role="button"]')];
      return nodes.some((node) => (node.textContent ?? '').trim() === text);
    }, label);
  }

  /**
   * Attend qu'un bouton soit là — et actif — puis le presse.
   *
   * Les boutons de l'hôte sont désactivés tant que la partie n'est pas prête
   * (§4.15) : cliquer dans le vide ne servirait à rien.
   */
  async clickLabelWhenReady(label, { timeout = 30000 } = {}) {
    const wanted = JSON.stringify(label);
    await this.waitFor(
      `(() => {
        const nodes = [...document.querySelectorAll('button')];
        const target = nodes.find((node) => (node.textContent ?? '').trim() === ${wanted});
        return !!target && !target.disabled;
      })()`,
      { timeout, label: `le bouton « ${label} »` },
    );
    await this.clickLabel(label);
  }

  /** Attend qu'une expression devienne vraie. */
  async waitFor(expression, { timeout = 20000, label = expression } = {}) {
    return waitUntil(async () => this.evaluate(expression), { timeout, label });
  }

  /**
   * Écrit dans un champ, trouvé par son étiquette visible.
   *
   * Comme les boutons, les champs sont trouvés par le texte que le joueur
   * voit : le harnais ne gratte jamais le DOM (§12.11).
   */
  async fill(label, text) {
    const filled = await this.evaluate((wanted, value) => {
      const labels = [...document.querySelectorAll('label')];
      const found = labels.find((node) => {
        const caption = node.querySelector('.field__label');
        return (caption?.textContent ?? node.textContent ?? '').trim() === wanted;
      });
      const field = found?.control ?? null;
      if (!field) return false;
      // Le setter natif : React n'écoute sinon les changements de valeur.
      const proto =
        field instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(field, value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }, label, text);
    if (!filled) throw new Error(`Champ introuvable : « ${label} »`);
  }

  /** Le texte d'un élément, pour lire ce que le joueur voit. */
  async text(selector) {
    const value = await this.evaluate(
      (sel) => document.querySelector(sel)?.textContent?.trim() ?? '',
      selector,
    );
    return value;
  }

  /** Va à une adresse et attend la fin du chargement. */
  async goto(url) {
    await this.send('Page.navigate', { url });
    await this.waitFor('document.readyState === "complete"', { label: `le chargement de ${url}` });
  }

  async screenshot(path) {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' });
    const { writeFile, mkdir } = await import('node:fs/promises');
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, Buffer.from(shot.data, 'base64'));
    return path;
  }

  async close() {
    await this.browser.client.send('Target.closeTarget', { targetId: this.targetId });
  }
}

export class Chrome {
  constructor(process, client, userDataDir) {
    this.process = process;
    this.client = client;
    this.userDataDir = userDataDir;
  }

  /** Lance un vrai Google Chrome et s'y attache. */
  static async launch({ headless = false } = {}) {
    const binary = await findChrome();
    const userDataDir = await mkdtemp(join(tmpdir(), 'jdd-chrome-'));
    const args = [
      ...CHROME_FLAGS,
      `--user-data-dir=${userDataDir}`,
      '--remote-debugging-port=0',
      ...(headless ? ['--headless=new'] : []),
      'about:blank',
    ];

    const child = spawn(binary, args, { stdio: 'ignore', detached: false });
    const endpoint = await devToolsEndpoint(userDataDir);
    const client = await connect(endpoint);
    return new Chrome(child, client, userDataDir);
  }

  /**
   * Ouvre une page dans un contexte isolé : elle a son propre stockage,
   * comme un téléphone distinct.
   */
  async newPage({ url, viewport = { width: 390, height: 844 }, seed } = {}) {
    const { browserContextId } = await this.client.send('Target.createBrowserContext', {
      disposeOnDetach: false,
    });
    const { targetId } = await this.client.send('Target.createTarget', {
      url: 'about:blank',
      browserContextId,
      newWindow: true,
    });
    const { sessionId } = await this.client.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    });

    const page = new Page(this, sessionId, targetId);
    this.pages = this.pages ?? [];
    this.pages.push(page);

    await page.send('Page.enable', {});
    await page.send('Runtime.enable', {});
    await page.send('Log.enable', {});
    await page.send('Network.enable', {});

    // Le pseudo est injecté **avant** le démarrage de l'application : le
    // harnais n'a pas à piloter l'écran de salon (§12.11).
    if (seed) {
      await page.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `try { localStorage.setItem(${JSON.stringify(seed.key)}, ${JSON.stringify(seed.value)}); } catch (e) {}`,
      });
    }

    await page.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 3,
      mobile: true,
    });

    // On note ce qui se passe dans la console : le harnais exige qu'elle
    // reste propre (§12.2, T4).
    this.client.on((message) => {
      if (message.sessionId !== sessionId) return;
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        page.consoleErrors.push(
          message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '),
        );
      }
      if (message.method === 'Runtime.exceptionThrown') {
        page.consoleErrors.push(
          message.params.exceptionDetails.exception?.description ??
            message.params.exceptionDetails.text,
        );
      }
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
        // Seuls les ordres du navigateur comptent : un relais qui tombe ne
        // dit rien du code de l'application, et l'application le sait déjà.
        if (message.params.entry.source === 'javascript') {
          page.consoleErrors.push(message.params.entry.text);
        }
      }
      if (message.method === 'Network.loadingFailed') {
        page.failedRequests.push(message.params.errorText);
      }
    });

    if (url) await page.goto(url);
    return page;
  }

  async close() {
    try {
      this.client.close();
    } catch {
      // La connexion est peut-être déjà tombée.
    }
    this.process.kill();
    await sleep(200);
    await rm(this.userDataDir, { recursive: true, force: true });
  }
}
