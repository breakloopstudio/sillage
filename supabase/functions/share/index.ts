// supabase/functions/share/index.ts — Landing de partage (communauté Phase 1)
// SSR HTML + balises OG → aperçu riche quand le lien est partagé (iMessage,
// WhatsApp, Instagram…). Endpoint PUBLIC (--no-verify-jwt) : ne renvoie que des
// données publiques (catalogue + profils/collections explicitement publics).
//
// URLs :
//   ?type=parfum&id=<parfumId>      → fiche parfum
//   ?type=profile&pseudo=<pseudo>   → profil public + aperçu collection

import { createAdminClient } from '../_shared/supabase.ts';
import { toNum } from '../_shared/helpers.ts';

const APP_SCHEME = 'parfumscan';
const FOOTER = 'ParfumScan · l\u2019expertise parfum, le bon prix';
const STORE_NOTE = 'L\u2019app arrive bientôt sur l\u2019App Store et Google Play';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(v: number): string {
  return `${v.toFixed(2).replace('.', ',')}\u00A0€`;
}

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background: #FAF8F5; color: #1A1520;
  display: flex; flex-direction: column; align-items: center;
  min-height: 100vh; padding: 28px 16px;
}
.wrap { width: 100%; max-width: 440px; }
.card { background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 30px rgba(31,26,46,0.10); border: 1px solid #E8E4DE; }
.hero { width: 100%; aspect-ratio: 4/3; object-fit: contain; background: linear-gradient(180deg,#fff,#F3F1ED); display: block; }
.hero-ph { width: 100%; aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center; background: #F3F1ED; color: #988EA8; font-size: 56px; font-weight: 700; }
.body { padding: 22px 22px 24px; text-align: center; }
.brand { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #6E6963; margin-bottom: 6px; }
.name { font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; line-height: 1.25; margin-bottom: 8px; }
.meta { font-size: 14px; color: #6E6963; margin-bottom: 6px; }
.price { font-weight: 700; color: #0D9488; font-size: 18px; margin-bottom: 16px; }
.avatar { width: 88px; height: 88px; border-radius: 44px; object-fit: cover; margin: 4px auto 12px; display: block; background: #F3F1ED; }
.avatar-ph { width: 88px; height: 88px; border-radius: 44px; margin: 4px auto 12px; display: flex; align-items: center; justify-content: center; background: #EDE7FB; color: #6C3ED9; font-size: 34px; font-weight: 700; }
.bio { font-size: 14px; color: #6E6963; margin-bottom: 8px; }
.author { font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #6E6963; margin-bottom: 4px; }
.tagline { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 15px; color: #6E6963; margin-bottom: 10px; }
.count { font-size: 13px; color: #6E6963; margin-bottom: 16px; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 0 0 18px; }
.gi { text-align: center; min-width: 0; }
.gi img { width: 100%; aspect-ratio: 3/4; object-fit: contain; background: #F3F1ED; border-radius: 8px; display: block; }
.gi-ph { width: 100%; aspect-ratio: 3/4; background: #F3F1ED; border-radius: 8px; }
.gi span { display: block; font-size: 10px; color: #6E6963; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cta { display: block; width: 100%; padding: 14px; border-radius: 12px; background: #6C3ED9; color: #fff; text-align: center; text-decoration: none; font-weight: 600; font-size: 16px; margin-bottom: 10px; }
.store { text-align: center; font-size: 12px; color: #988EA8; }
.footer { text-align: center; font-size: 12px; color: #988EA8; margin-top: 20px; }
`;

interface Meta {
  title: string;
  description: string;
  image: string | null;
  url: string;
}

function page(meta: Meta, bodyHtml: string): string {
  const img = meta.image
    ? `<meta property="og:image" content="${escapeHtml(meta.image)}"><meta name="twitter:image" content="${escapeHtml(meta.image)}">`
    : '';
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#FAF8F5">
<title>${escapeHtml(meta.title)}</title>
<meta property="og:title" content="${escapeHtml(meta.title)}">
<meta property="og:description" content="${escapeHtml(meta.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeHtml(meta.url)}">
<meta property="og:site_name" content="ParfumScan">
<meta property="og:locale" content="fr_FR">
<link rel="canonical" href="${escapeHtml(meta.url)}">
${img}
<meta name="twitter:card" content="${meta.image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${escapeHtml(meta.title)}">
<meta name="twitter:description" content="${escapeHtml(meta.description)}">
<style>${CSS}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}

function notFoundPage(): Response {
  const body = `
<div class="wrap">
  <div class="card"><div class="body">
    <h1 class="name">Contenu introuvable</h1>
    <div class="meta">Ce parfum ou ce profil n\u2019est pas disponible (ou est privé).</div>
  </div></div>
  <div class="footer">${FOOTER}</div>
</div>`;
  return htmlResponse(page({ title: 'ParfumScan', description: 'Contenu introuvable.', image: null, url: '' }, body), 404);
}

// ─── Rendus ──────────────────────────────────────────────────────────────────

interface ParfumRow { id: string; nom: string | null; marque: string | null; image_url: string | null; famille_olfactive: string | null; best_price: number | null; }

function parfumBody(p: ParfumRow): string {
  const initial = escapeHtml((p.marque || 'P').charAt(0).toUpperCase());
  const hero = p.image_url
    ? `<img class="hero" src="${escapeHtml(p.image_url)}" alt="">`
    : `<div class="hero-ph">${initial}</div>`;
  const family = p.famille_olfactive ? `<div class="meta">${escapeHtml(p.famille_olfactive)}</div>` : '';
  const bestPrice = toNum(p.best_price);
  const price = bestPrice !== null ? `<div class="price">dès ${formatPrice(bestPrice)}</div>` : '';
  return `
<div class="wrap">
  <div class="card">
    ${hero}
    <div class="body">
      <div class="brand">${escapeHtml(p.marque || '')}</div>
      <h1 class="name">${escapeHtml(p.nom || '')}</h1>
      ${family}
      ${price}
      <a class="cta" href="${APP_SCHEME}://catalog/${encodeURIComponent(p.id)}">Ouvrir dans ParfumScan</a>
      <div class="store">${STORE_NOTE}</div>
    </div>
  </div>
  <div class="footer">${FOOTER}</div>
</div>`;
}

interface ProfileRow { pseudo: string; avatar_url: string | null; bio: string | null; collection_count: number | string | null; }
interface CollectionRow { parfum_id: string; nom: string | null; marque: string | null; image_url: string | null; }

function profileBody(prof: ProfileRow, items: CollectionRow[]): string {
  const count = Number(prof.collection_count ?? 0);
  const initial = escapeHtml((prof.pseudo || 'P').charAt(0).toUpperCase());
  const avatar = prof.avatar_url
    ? `<img class="avatar" src="${escapeHtml(prof.avatar_url)}" alt="">`
    : `<div class="avatar-ph">${initial}</div>`;
  const bio = prof.bio ? `<div class="bio">${escapeHtml(prof.bio)}</div>` : '';
  const grid = items.length > 0
    ? `<div class="grid">${items.map((it) => `
        <div class="gi">
          ${it.image_url ? `<img src="${escapeHtml(it.image_url)}" alt="">` : '<div class="gi-ph"></div>'}
          <span>${escapeHtml(it.nom || it.marque || '')}</span>
        </div>`).join('')}
      </div>`
    : '';
  return `
<div class="wrap">
  <div class="card">
    <div class="body">
      ${avatar}
      <h1 class="name">${escapeHtml(prof.pseudo)}</h1>
      ${bio}
      <div class="count">${count} parfum${count > 1 ? 's' : ''} dans sa parfumerie</div>
      ${grid}
      <a class="cta" href="${APP_SCHEME}://u/${encodeURIComponent(prof.pseudo)}">Voir sur ParfumScan</a>
      <div class="store">${STORE_NOTE}</div>
    </div>
  </div>
  <div class="footer">${FOOTER}</div>
</div>`;
}

interface ShelfRow { shelf_id: string; name: string; description: string | null; item_count: number | string | null; pseudo: string; avatar_url: string | null; bio: string | null; }
interface ShelfItemRow { parfum_id: string; nom: string | null; marque: string | null; image_url: string | null; }

function shelfBody(shelf: ShelfRow, items: ShelfItemRow[]): string {
  const initial = escapeHtml((shelf.pseudo || 'P').charAt(0).toUpperCase());
  const avatar = shelf.avatar_url
    ? `<img class="avatar" src="${escapeHtml(shelf.avatar_url)}" alt="">`
    : `<div class="avatar-ph">${initial}</div>`;
  const author = shelf.pseudo ? `<div class="author">@${escapeHtml(shelf.pseudo)}</div>` : '';
  const tagline = shelf.description ? `<div class="tagline">${escapeHtml(shelf.description)}</div>` : '';
  const bio = shelf.bio ? `<div class="bio">${escapeHtml(shelf.bio)}</div>` : '';
  const count = Number(shelf.item_count ?? 0);
  const grid = items.length > 0
    ? `<div class="grid">${items.map((it) => `
        <div class="gi">
          ${it.image_url ? `<img src="${escapeHtml(it.image_url)}" alt="">` : '<div class="gi-ph"></div>'}
          <span>${escapeHtml(it.nom || it.marque || '')}</span>
        </div>`).join('')}
      </div>`
    : '';
  return `
<div class="wrap">
  <div class="card">
    <div class="body">
      ${avatar}
      ${author}
      <h1 class="name">${escapeHtml(shelf.name)}</h1>
      ${tagline}
      ${bio}
      <div class="count">${count} parfum${count > 1 ? 's' : ''} dans cette étagère</div>
      ${grid}
      <a class="cta" href="${APP_SCHEME}://u/${encodeURIComponent(shelf.pseudo)}/shelf/${encodeURIComponent(shelf.shelf_id)}">Voir sur ParfumScan</a>
      <div class="store">${STORE_NOTE}</div>
    </div>
  </div>
  <div class="footer">${FOOTER}</div>
</div>`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const supabase = createAdminClient();

  if (type === 'parfum') {
    const id = url.searchParams.get('id');
    if (!id) return notFoundPage();
    const { data } = await supabase
      .from('parfums')
      .select('id, nom, marque, image_url, famille_olfactive, best_price')
      .eq('id', id)
      .maybeSingle();
    if (!data) return notFoundPage();
    const p = data as ParfumRow;
    const title = `${p.marque ?? ''} ${p.nom ?? ''}`.trim() || 'Parfum';
    const desc = p.famille_olfactive
      ? `${p.famille_olfactive} — découvre ce parfum sur ParfumScan`
      : 'Découvre ce parfum sur ParfumScan';
    const canonical = `${url.origin}${url.pathname}?type=parfum&id=${encodeURIComponent(id)}`;
    return htmlResponse(page({ title, description: desc, image: p.image_url, url: canonical }, parfumBody(p)));
  }

  if (type === 'profile') {
    const pseudo = url.searchParams.get('pseudo');
    if (!pseudo) return notFoundPage();
    const [profRes, colRes] = await Promise.all([
      supabase.rpc('public_profile', { p_pseudo: pseudo }),
      supabase.rpc('public_collection', { p_pseudo: pseudo }),
    ]);
    const prof = (Array.isArray(profRes.data) ? profRes.data[0] : profRes.data) as ProfileRow | null;
    if (!prof) return notFoundPage();
    const items = ((colRes.data ?? []) as CollectionRow[]).slice(0, 8);
    const title = `${prof.pseudo} · ParfumScan`;
    const desc = prof.bio || `${Number(prof.collection_count ?? 0)} parfums dans sa parfumerie sur ParfumScan`;
    const canonical = `${url.origin}${url.pathname}?type=profile&pseudo=${encodeURIComponent(pseudo)}`;
    return htmlResponse(page({ title, description: desc, image: prof.avatar_url, url: canonical }, profileBody(prof, items)));
  }

  if (type === 'shelf') {
    const pseudo = url.searchParams.get('pseudo');
    const shelfId = url.searchParams.get('shelf');
    if (!pseudo || !shelfId) return notFoundPage();
    const [shelfRes, itemsRes] = await Promise.all([
      supabase.rpc('public_shelf', { p_pseudo: pseudo, p_shelf_id: shelfId }),
      supabase.rpc('public_shelf_items', { p_pseudo: pseudo, p_shelf_id: shelfId }),
    ]);
    const shelf = (Array.isArray(shelfRes.data) ? shelfRes.data[0] : shelfRes.data) as ShelfRow | null;
    if (!shelf) return notFoundPage();
    const items = ((itemsRes.data ?? []) as ShelfItemRow[]).slice(0, 12);
    const title = `${shelf.name} · @${shelf.pseudo}`;
    const desc = shelf.description || `${Number(shelf.item_count ?? 0)} parfums dans l\u2019étagère de @${shelf.pseudo}`;
    const ogImage = items.find((i) => i.image_url)?.image_url ?? shelf.avatar_url;
    const canonical = `${url.origin}${url.pathname}?type=shelf&pseudo=${encodeURIComponent(pseudo)}&shelf=${encodeURIComponent(shelfId)}`;
    return htmlResponse(page({ title, description: desc, image: ogImage, url: canonical }, shelfBody(shelf, items)));
  }

  return notFoundPage();
});
