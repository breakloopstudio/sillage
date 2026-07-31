import * as fs from 'fs';
import * as path from 'path';

/**
 * Déchiffrement des payloads Fragrantica (format CryptoJS { ct, iv, s }).
 *
 * Les stats de votes d'une fiche parfum (longevity/sillage/price value/rating/
 * saisons/gender/relation) sont embarquées dans la page en variables JS chiffrées
 * (`let status = {...}`). Le déchiffreur officiel vit dans le chunk webpack
 * `new-js/chunks/mfga-fes.js` — on l'exécute ici dans un shim minimal plutôt
 * que de réimplémenter la crypto (clé dérivée de window.location.host).
 *
 * Le chunk est vendorisé dans scripts/lib/mfga-fes.js. Pour le rafraîchir :
 *   curl -H "User-Agent: ..." https://www.fragrantica.com/new-js/chunks/mfga-fes.js -o scripts/lib/mfga-fes.js
 */

export interface EncryptedPayload {
  ct: string;
  iv: string;
  s: string;
}

type DecryptFn = (payload: EncryptedPayload) => Promise<unknown>;

let decryptPromise: Promise<DecryptFn> | null = null;

function loadDecryptor(): Promise<DecryptFn> {
  if (decryptPromise) return decryptPromise;

  decryptPromise = (async () => {
    const chunkPath = path.join(__dirname, 'mfga-fes.js');
    const chunkCode = fs.readFileSync(chunkPath, 'utf8');

    // Shim browser : le déchiffreur référence window.* et location.host
    const g = globalThis as Record<string, unknown>;
    g.window = g;
    g.location = {
      host: 'www.fragrantica.com',
      hostname: 'www.fragrantica.com',
      protocol: 'https:',
      href: 'https://www.fragrantica.com/',
    };

    // Shim webpack : capture les modules du chunk
    const chunks: [unknown[], Record<string, (m: unknown, e: unknown, r: unknown) => void>][] = [];
    const selfRef = { webpackChunkfragrantica_svn: { push: (c: (typeof chunks)[number]) => chunks.push(c) } };
    new Function('self', chunkCode)(selfRef);
    if (chunks.length === 0) throw new Error('mfga-fes.js : aucun chunk capturé (fichier périmé ?)');

    const modules = chunks[0][1];
    const cache: Record<string, { exports: Record<string, unknown> }> = {};
    const req = ((id: string) => {
      if (cache[id]) return cache[id].exports;
      if (!modules[id]) throw new Error(`mfga-fes.js : module ${id} absent`);
      const m = { exports: {} as Record<string, unknown> };
      cache[id] = m;
      modules[id](m, m.exports, req);
      return m.exports;
    }) as {
      (id: string): Record<string, unknown>;
      d: (exports: Record<string, unknown>, def: Record<string, () => unknown>) => void;
      r: (exports: Record<string, unknown>) => void;
      n: (mod: { __esModule?: boolean; default?: unknown }) => () => unknown;
      o: (obj: object, prop: string) => boolean;
    };
    req.d = (exports, def) => {
      for (const k of Object.keys(def)) {
        Object.defineProperty(exports, k, { enumerable: true, get: def[k] });
      }
    };
    req.r = (exports) => {
      Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    };
    req.n = (mod) => (mod && mod.__esModule ? () => mod.default : () => mod);
    req.o = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);

    // 2616 = module du déchiffreur (export default { _pd })
    const mod = req('2616') as { default: { _pd: DecryptFn } };
    if (typeof mod.default?._pd !== 'function') {
      throw new Error('mfga-fes.js : _pd introuvable dans le module 2616');
    }
    return mod.default._pd;
  })();

  return decryptPromise;
}

/** Déchiffre un payload { ct, iv, s } et retourne l'objet JSON. */
export async function decryptPayload<T = unknown>(payload: EncryptedPayload): Promise<T> {
  const decrypt = await loadDecryptor();
  const result = await decrypt(payload);
  return (typeof result === 'string' ? JSON.parse(result) : result) as T;
}
