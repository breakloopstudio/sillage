import * as fs from 'fs';
import * as path from 'path';

/**
 * Utilitaires partagés des scripts de pipeline (lecture .env + args CLI).
 *
 * Note : test-supabase-e2e.ts garde volontairement sa propre variante de
 * readEnvVar qui ÉCHOUE si la clé manque (fail-fast au démarrage du test).
 */

/** Lit une clé dans .env (sans dépendance dotenv). undefined si absente/illisible. */
export function readEnvVar(key: string): string | undefined {
  try {
    const content = fs.readFileSync(path.resolve('.env'), 'utf8');
    const m = content.match(new RegExp(`^${key}\\s*=\\s*(.+?)\\s*$`, 'm'));
    return m ? m[1] : undefined;
  } catch {
    return undefined;
  }
}

/** Valeur d'un arg `--nom=valeur` (undefined si absent). */
export function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

/** Présence d'un flag `--nom`. */
export function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}
