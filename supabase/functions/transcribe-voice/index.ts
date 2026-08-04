// Supabase Edge Function: transcribe-voice (v4)
// Transcription audio — fallback de la reconnaissance vocale on-device.
// v4 : MULTILINGUE — modèle `gpt-transcribe` (recommandé OpenAI) avec le
// vocabulaire passé en `keywords` (termes littéraux attendus, biasing noms
// propres — bien plus fiable qu'un prompt tronqué) et `languages` (indices
// ISO 639-1 envoyés par le client, auto-détection si absents). Les marques et
// noms de parfums ne se traduisent pas → la liste fonctionne dans toutes les
// langues. Liste rejouable : scripts/voice-vocab.ts.
// Appelée par le client voice-search.ts.

import OpenAI from 'npm:openai';
import { createUserClient, verifyUserToken } from '../_shared/supabase.ts';

// Surchargeable via secret pour suivre l'évolution des modèles sans redéploiement.
const TRANSCRIBE_MODEL = Deno.env.get('VOICE_TRANSCRIBE_MODEL') ?? 'gpt-transcribe';

// ⚠️ Généré depuis le catalogue par scripts/voice-vocab.ts (rejouable).
// TOUTES les marques du catalogue (~240) — l'ASR écorche les maisons niches
// autant que les grandes (« Serge Lutens » → « serge lutins », « Electimuss »
// → « electimus »). Orthographe catalogue.
const BRANDS = [
  'Dolce&Gabbana', 'Mugler', 'Lancôme', 'Yves Saint Laurent',
  'Dior', 'Chanel', 'Tom Ford', 'Versace',
  'Maison Francis Kurkdjian', 'Lattafa Perfumes', 'Hermès', 'Armaf',
  'Creed', 'Jean Paul Gaultier', 'Maison Martin Margiela', 'Carolina Herrera',
  'Giorgio Armani', 'Lalique', 'Rabanne', 'Chloé',
  'Calvin Klein', 'By Kilian', 'Viktor&Rolf', 'Narciso Rodriguez',
  'Davidoff', 'Xerjoff', 'Issey Miyake', 'Guerlain',
  'Parfums de Marly', 'Byredo', 'Lanvin', 'Afnan',
  'Ariana Grande', 'Donna Karan', 'Montblanc', 'Prada',
  'Britney Spears', 'Elizabeth Arden', 'Kenzo', 'Burberry',
  'Jo Malone London', 'Nina Ricci', 'Essential Parfums', 'Cacharel',
  'Juliette Has A Gun', 'Givenchy', 'Mancera', 'Hugo Boss',
  'Marc Jacobs', 'Moschino', 'Le Labo', 'French Avenue',
  'Serge Lutens', 'Louis Vuitton', 'Nasomatto', 'Zadig & Voltaire',
  'Marc-Antoine Barrois', 'Joop!', 'Sol de Janeiro', 'Diptyque',
  'Frederic Malle Editions de Parfums', 'Nishane', 'Azzaro', 'Kayali Fragrances',
  'Billie Eilish', 'Valentino', 'Rasasi', 'Giardini Di Toscana',
  'Bentley', 'Casamorati 1888', 'Gucci', 'Bvlgari',
  'Lacoste Fragrances', 'Montale', 'Tiziana Terenzi', 'Amouage',
  'Escentric Molecules', 'Initio Parfums Prives', 'Estée Lauder', 'Jimmy Choo',
  'BDK Parfums', 'Cerruti', 'Orto Parisi', 'Tommy Hilfiger',
  'Guy Laroche', 'Ex Nihilo', 'Tauer Perfumes', 'Les Liquides Imaginaires',
  'Chopard', 'Etat Libre d\'Orange', 'Bottega Veneta', 'Ralph Lauren',
  'Cartier', 'Balenciaga', 'Trussardi', 'Vera Wang',
  'Roberto Cavalli', 'Mercedes-Benz', 'Avon', 'Rochas',
  'Victoria\'s Secret', 'Memo Paris', 'Al Haramain Perfumes', 'Roja Dove',
  'Van Cleef & Arpels', 'Sospiro Perfumes', 'Maison Crivelli', 'Escada',
  'Penhaligon\'s', 'Comme des Garcons', 'Stella McCartney', 'Salvatore Ferragamo',
  'Coach', 'Abercrombie & Fitch', 'Acqua di Parma', 'Vilhelm Parfumerie',
  'Commodity', 'L\'Artisan Parfumeur', 'Jil Sander', 'Diesel',
  'Matiere Premiere', 'Lush', 'Laura Biagiotti', 'Swiss Arabian',
  'Zara', 'Stéphane Humbert Lucas 777', 'Goldfield & Banks Australia', 'Nobile 1942',
  'Histoires de Parfums', 'DSQUARED²', 'Beyoncé', 'Phlur',
  'PARIS CORNER', 'Zoologist Perfumes', 'Missoni', 'Maison Alhambra',
  'Ted Lapidus', 'Room 1015', 'Boucheron', 'Caron',
  'Natura', 'Jovoy Paris', 'Loewe', 'Tiffany',
  'Khadlaj Perfumes', 'Imaginary Authors', 'M. Micallef', 'Clive Christian',
  'Carner Barcelona', 'Michael Kors', 'Arabiyat Prestige', 'Bond No 9',
  'O Boticário', 'Karl Lagerfeld', 'Fendi', 'Dries Van Noten',
  'Rayhaan', 'Fugazzi', 'Zimaya', 'Oscar de la Renta',
  'Bath & Body Works', 'Parfum d\'Empire', 'Ormonde Jayne', 'Banana Republic',
  'MDCI Parfums', 'Lorenzo Pazzaglia', 'Balmain Beauty', 'Thameen',
  'BeauFort London', 'James Heeley', 'Jeroboam', 'd\'Annam',
  'Aerin', 'The Different Company', 'Toskovat\'', 'Etro',
  'David Beckham', 'Granado', 'Alexander McQueen', 'Mind Games',
  'Filippo Sorcinelli', 'Houbigant', 'Ella K Parfums', 'Jaguar',
  'Celine', 'Une Nuit Nomade', 'WIDIAN', 'EIGHT & BOB',
  'D\'ORSAY', 'Carven', 'The House of Oud', 'V Canto',
  'BORNTOSTANDOUT', 'MAISON ASRAR', 'Demeter Fragrance', 'Adolfo Dominguez',
  'Electimuss', 'Boadicea the Victorious', 'Ermenegildo Zegna', 'Bohoboco',
  'Gulf Orchid', 'Scents of Wood', 'Fragrance World', 'Bois 1920',
  'Pierre Cardin', 'Bourjois', 'Abdul Samad Al Qurashi', 'Sorce',
  'Bon Parfumeur', 'Maison Matine', 'Acca Kappa', 'Bortnikoff',
  'Aaron Terence Hughes', 'Trudon', 'Borsari', 'Strangelove NYC',
  'Porsche Design', 'Adopt Parfums', 'Scentologia', 'Black Phoenix Alchemy Lab',
  'Esprit', 'Thomas de Monaco', 'Baldinini', 'Buly 1803',
  'Be Layered', 'Henry Jacques', 'Welton London', 'Stéphanie de Bruijn',
  'Aéropostale', 'Caswell Massey', 'Bastide Aix en Provence', 'Soul Of Mine',
  'Stellar Scents', 'Santa Eulalia', 'Acidica Perfumes', 'Tayshaba',
  'Bargello',
];

// Top 400 noms de parfums du catalogue par popularité (scripts/voice-vocab.ts).
// La garde budget de buildTranscribePrompt tronque ce qui dépasse (~210 retenus).
// Ce sont les mots que l'ASR écorche le plus : sans eux, « Aventus » devient
// « prix d'avant », « Ombre Leather » devient « ombrer les heures ».
const PERFUME_NAMES = [
  'Light Blue', 'Alien', 'La Vie Est Belle', 'Angel',
  'Black Opium', 'Sauvage', 'Coco Mademoiselle', 'Black Orchid',
  'Tobacco Vanille', 'Hypnotic Poison', 'Eros', 'J\'adore',
  'Baccarat Rouge 540', 'Khamrah', 'Terre d\'Hermès', 'Club de Nuit Intense Man',
  'Y Eau de Parfum', 'Aventus', 'Le Male Le Parfum', 'By the Fireplace',
  'Good Girl', 'Acqua di Gio', 'Le Male Elixir', 'Versace Pour Homme Dylan Blue',
  'Le Male', 'Encre Noire', 'Emporio Armani Stronger With You Intensely', 'Crystal Noir',
  'Dior Homme Intense 2011', 'La Nuit de l\'Homme', 'Bright Crystal', '1 Million',
  'Chloé Eau de Parfum', 'Euphoria', 'Angels\' Share', 'Fahrenheit',
  'CK One', 'Bleu de Chanel Eau de Parfum', 'Versace Pour Homme', 'Libre',
  'Flowerbomb', 'Bleu de Chanel', 'Jazz Club', 'Narciso Rodriguez For Her',
  'Cool Water', 'XJ 1861 Naxos', 'Chance Eau Tendre', 'Si',
  'L\'Eau d\'Issey Pour Homme', 'D&G Anthology L\'Imperatrice 3', 'Eros Flame', 'Sauvage Elixir',
  'Shalimar Eau de Parfum', 'Layton', 'Bal d\'Afrique', 'Ombré Leather',
  'Le Beau Le Parfum', 'Lost Cherry', 'Eclat d’Arpège', '9pm',
  'Pure Poison', 'Cloud', 'DKNY Be Delicious', 'Ultra Male',
  'Oud Wood', 'The One', 'Explorer', 'Acqua di Gioia',
  'Spicebomb Extreme', 'Versace Man Eau Fraiche', 'Prada Candy', 'Fantasy',
  'Acqua di Giò Profumo', 'Green Tea', 'Prada L\'Homme', 'Mon Guerlain',
  'Poison', 'Flower by Kenzo', 'The One for Men Eau de Parfum', 'Burberry Her',
  'Wood Sage & Sea Salt', 'Allure Homme Sport', 'Chance Eau Fraiche', 'Hypnôse',
  'Dior Addict', 'Nina', 'Un Jardin Sur Le Nil', 'Invictus',
  'Bois Impérial', 'Khamrah Qahwa', 'Amor Amor', 'Miracle',
  'Not A Perfume', 'Armani Code for Women', 'Olympéa', 'The One for Men',
  'L\'Interdit Eau de Parfum', 'Lady Million', 'Sauvage Eau de Parfum', 'Grand Soir',
  'Cedrat Boise', 'Boss Bottled', 'Daisy', 'Spicebomb',
  'Cheap & Chic I Love Love', 'Goddess', 'Noa', 'Delina',
  'Asad', 'Kenzo Jungle L\'Elephant', 'Chanel No 5 Parfum', 'Narciso Rodriguez for Her Eau de Parfum',
  'My Way', 'Idôle', 'MYSLF Eau de Parfum', 'Ange ou Demon',
  'Trésor', 'Noir Extreme', 'Santal 33', 'Coco Eau de Parfum',
  'Toy Boy', 'Red Tobacco', 'Dune', 'Poeme',
  'Love Don\'t Be Shy', 'Allure Homme Sport Eau Extreme', 'Liquid Brun', 'La Nuit Trésor',
  'Chergui', 'Imagination', 'Classique', 'Black Afgano',
  'Midnight Fantasy', 'Chance Eau de Toilette', 'Erba Pura', 'This is Her',
  'Ganymede', 'Egoiste Platinum', 'Joop! Homme', 'London for Men',
  'Chanel No 5 Eau de Parfum', 'Green Irish Tweed', 'Devotion', 'Versense',
  'Coco Noir', 'Cheirosa \'62', 'Le Beau Paradise Garden', 'L\'Homme',
  'Acqua di Giò Profondo', 'L\'eau d\'Issey', 'La Petite Robe Noire', 'Yara',
  'Armani Code', 'Le Beau', 'Organza', 'Philosykos Eau de Parfum',
  'Portrait of a Lady', 'Hacivat', 'The Most Wanted', 'Vanilla | 28',
  'Infusion d\'Iris', 'Womanity', 'Miss Dior Blooming Bouquet', 'Eilish',
  'Libre Intense', 'Baccarat Rouge 540 Extrait de Parfum', 'Valentino Uomo Born In Roma Intense', 'Light Blue Eau Intense Pour Homme',
  'Gypsy Water', 'Trésor Midnight Rose', 'Kenzo Amour', 'Silver Mountain Water',
  'The Most Wanted Parfum', 'Valentino Donna Born In Roma', 'Hawas for Him', 'A*Men',
  'Blue Jeans', 'Althaïr', 'Bianco Latte', 'Dolce Vita',
  'LouLou', 'Emporio Armani Stronger With You', 'Nomade', 'Bleu de Chanel Parfum',
  'Cinéma', 'Bentley for Men Intense', 'Herod', 'Aura Mugler',
  'Ani', 'Lira', 'Gucci Rush', 'Obsession',
  'Bvlgari Man In Black', 'Gucci Bloom', 'Prada Paradoxe', 'Gentleman Eau de Parfum Reserve Privée',
  'Tuscan Leather', 'Omnia Crystalline', 'Mon Paris', 'Dior Homme Parfum',
  'Lacoste Pour Femme', '5th Avenue', 'Intense Cafe', 'Kirkè',
  'Reflection Man', 'Black Phantom', 'Molecule 01', 'Musc Ravageur',
  'Mojave Ghost', 'L’Homme Idéal Eau de Parfum', 'Oud Satin Mood', 'Narciso Poudree',
  'Gucci Guilty', 'Midnight Poison', 'Scandal', 'Side Effect',
  'Emporio Armani Stronger With You Absolutely', 'Pleasures', 'Poison Girl', 'Pure Musc For Her',
  'Fabulous', 'English Pear & Freesia', 'Jimmy Choo', 'Black XS for Her',
  'Lazy Sunday Morning', 'Neroli Portofino', 'Blanche', 'Chocolate Greedy',
  'La Belle', 'Allure Eau de Parfum', 'Eternity', 'Valentino Uomo Born In Roma Coral Fantasy',
  'Dior Homme 2020', 'Anais Anais', 'Amarige', 'Burberry Brit',
  'Pi', 'Shalimar Parfum Initial', 'Beach Walk', 'Eclaire',
  '212 Men', 'Kouros', 'Gris Charnel', '1881',
  'Interlude Man', 'Velvet Orchid', 'London', 'Soleil Blanc',
  'Instant Crush', 'L\'Interdit Eau de Parfum Rouge', 'L\'Eau par Kenzo', 'Another 13',
  'Eden', 'Aqua Allegoria Mandarine Basilic', 'Light Blue pour Homme', 'Alien Goddess',
  'Noir de Noir', 'Virgin Island Water 2007', 'Terre d\'Hermes Parfum', 'Supremacy Collector\'s Edition Pour Homme',
  'CK IN2U for Her', 'Eros Eau de Parfum', 'Grey Vetiver', 'Arabians Tonka',
  'Angel Muse', 'Weekend for Women', 'Legend Spirit', 'Opium',
  'Individuel', 'Good Girl Gone Bad', 'Chrome', 'Body',
  'Megamare', 'Tommy Girl', 'L\'Instant de Guerlain', 'Legend',
  'Luna Rossa Carbon Eau de Toilette', 'Un Jardin en Méditerranée', 'Oud for Greatness', 'Aqva Pour Homme',
  'Drakkar Noir', 'Insolence', 'Bade\'e Al Oud Oud for Glory', 'Eau des Merveilles',
  'Ange Ou Demon Le Secret', 'Encre Noire A L\'Extreme', 'Moschino Funny!', 'Ambre Sultan',
  'Angel Nova', 'Torino21', 'Fleur Narcotique', 'Guidance',
  'Gabrielle', '02 L\'Air du Desert Marocain', 'Valentino Uomo Born in Roma', 'Fakhar Black',
  'Deep Red', 'Delina Exclusif', 'CK One Shock For Him', 'Turathi Blue',
  'Un Jardin Sur Le Toit', 'Bade\'e Al Oud Honor & Glory', 'Jasmin Noir', 'Wanted by Night',
  'Very Good Girl', 'Luna Rossa Black', 'Manifesto', 'Miss Dior Cherie',
  'Blanche Bête', 'Mémoire d’une Odeur', 'Burberry Women', 'Bitter Peach',
  'Casmir', 'A*Men Pure Havane', 'Allure Homme Edition Blanche', 'Amethyst',
  'Opium Eau de Parfum 2009', 'Flora Gorgeous Gardenia', 'Cheirosa \'71', 'Daisy Eau So Fresh',
  'Love', '1 Million Lucky', 'Sì Passione', 'Scandal Pour Homme',
  'Egoiste', 'Dolce&Gabbana Pour Femme', 'Millésime Impérial', 'Perles De Lalique',
  'Myrrh & Tonka', 'Qaed Al Fursan', 'You Or Someone Like You', 'Hawas Ice',
  'Yellow Diamond', 'Azzaro pour Homme', 'Miss Dior', 'Narciso',
  'Signature', 'Musk Therapy', 'Blackberry & Bay', 'Bottega Veneta',
  'Decadence', '212 Sexy', 'Encre Noire Sport', 'Allure Sensuelle',
  'Allure Homme', 'Alexandria II', 'Champs Elysees Eau de Toilette', 'Polo Blue',
  'Gentle Fluidity Gold', 'CK be', 'Chanel No 5 L\'Eau', 'Prada L\'Homme Intense',
  'Un Bois Vanille', 'Miss Dior Eau de Parfum', 'Polo', 'Good Girl Blush',
  'Greenley', 'The Noir 29', 'Twilly d’Hermès', 'Carnal Flower',
  'Yum Pistachio Gelato | 33', 'Acqua di Giò Parfum', 'Ombre Nomade', 'Vanilla Vibes',
  'Roses Vanille', 'Ari', 'Phantom', 'La Panthere',
  'Lalique Le Parfum', 'Idylle', 'Dior Homme', 'Gucci Guilty Absolute',
  'Armani Code Parfum', 'Irresistible Givenchy', 'Jubilation XXV Man', 'Florabotanica',
  'Elixir des Merveilles', 'Trussardi Donna', 'A*Men Pure Malt', 'The Only One',
  'Eternity For Men', 'Oajan', 'Vetiver', 'L\'Air du Temps',
  'Princess', 'Chanel No 19 Eau de Parfum', 'Sunshine Woman', 'Feminité du Bois',
  'Pegasus', 'Back to Black', 'Declaration', 'Wulóng Chá',
  'La Tulipe', 'Pacific Chill', 'L\'Eau Papier', 'Obsession for Men',
  'Aqua Allegoria Herba Fresca', 'La Fille de Berlin', 'Parisienne', 'Eau Sauvage',
];

// Prompt court et NEUTRE EN LANGUE : le biasing noms propres passe par le
// paramètre `keywords` (dédié gpt-transcribe), plus de troncature budget.
const TRANSCRIBE_PROMPT = 'Voice search query for a perfume. The speaker may use any language. '
  + 'Perfume and brand names are proper nouns: when the phonetics are close, prefer the exact '
  + 'names from the keywords over common words of the spoken language. Keep names in their '
  + 'official spelling; do not translate them.';

// Keywords = marques + noms de parfums (universels, toutes langues).
// Caractères interdits par l'API (< > \r \n) → requête entière rejetée : sanitize.
// Dédupliqué (quelques entrées sont à la fois marque et nom : Jimmy Choo…).
const KEYWORDS = [...new Set(
  BRANDS.concat(PERFUME_NAMES)
    .map(k => k.replace(/[<>\r\n]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(k => k.length > 0),
)];

const EXT_BY_MIME: Record<string, string> = {
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/mp4': '.m4a',
  'audio/m4a': '.m4a',
  'audio/webm': '.webm',
  'audio/mpeg': '.mp3',
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let uid: string;
  try { ({ uid } = await verifyUserToken(req)); } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createUserClient(authHeader);

  let body: { audioBase64: string; mimeType: string; languages?: string[] };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'JSON invalide.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }

  const { audioBase64, mimeType } = body;
  if (typeof audioBase64 !== 'string' || audioBase64.length === 0) {
    return new Response(JSON.stringify({ error: 'audioBase64 requis.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  if (typeof mimeType !== 'string' || mimeType.length === 0) {
    return new Response(JSON.stringify({ error: 'mimeType requis.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  if (!EXT_BY_MIME[mimeType]) {
    return new Response(JSON.stringify({ error: 'Format audio non supporté.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Indices de langue (ISO 639-1, max 3) envoyés par le client — validés car
  // l'API rejette les codes mal formés. Absents/invalides → auto-détection.
  const LANG_RE = /^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$/;
  const languages = (Array.isArray(body.languages) ? body.languages : [])
    .filter((l): l is string => typeof l === 'string' && LANG_RE.test(l))
    .slice(0, 3);

  // Limite 10 Mo (parité Firebase) — base64 ≈ 1.37× la taille binaire
  const MAX_B64 = 10 * 1024 * 1024 * 1.37;
  if (audioBase64.length > MAX_B64) {
    return new Response(JSON.stringify({ error: 'Fichier audio trop volumineux (max 10 Mo).' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Rate limit — quota 'voice' partagé avec interpret-voice-query (RPC atomique).
  // Placé APRÈS la validation : une requête malformée ne consomme pas de quota.
  const { error: rateErr } = await supabase.rpc('check_and_increment_quota', { p_kind: 'voice', p_max: 60 });
  if (rateErr) {
    const msg = rateErr.message ?? '';
    if (msg.includes('resource-exhausted') || msg.includes('quotidienne')) {
      return new Response(JSON.stringify({ error: 'Limite quotidienne atteinte (voice).' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }
    console.error('[transcribeVoice] quota RPC failed:', msg);
    return new Response(JSON.stringify({ error: 'Service momentanément indisponible.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return new Response(JSON.stringify({ error: 'Clé API OpenAI non configurée.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const openai = new OpenAI({ apiKey, timeout: 60_000 });
  let buffer: Uint8Array;
  try {
    buffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
  } catch {
    return new Response(JSON.stringify({ error: 'Audio base64 invalide.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const file = new File([buffer], `audio${EXT_BY_MIME[mimeType]}`, { type: mimeType });

  // gpt-transcribe : keywords (biasing noms propres) + languages (indices).
  // Jamais `language` (singulier) avec ce modèle ; pas de response_format →
  // réponse JSON {text, languages} ; pas de temperature (non supporté).
  const createTranscription = (mode: 'full' | 'bare') =>
    openai.audio.transcriptions.create({
      model: TRANSCRIBE_MODEL,
      file,
      prompt: TRANSCRIBE_PROMPT,
      ...(mode === 'full' ? { keywords: KEYWORDS } : {}),
      ...(mode === 'full' && languages.length > 0 ? { languages } : {}),
    });

  try {
    let transcription: Awaited<ReturnType<typeof createTranscription>>;
    try {
      transcription = await createTranscription('full');
    } catch (e: unknown) {
      // Rejet 400 (keywords OU languages en cause : code de langue refusé,
      // modèle surchargé sans support languages…) → retry SANS keywords ni
      // languages. Le quota n'est pas re-consommé : même handler.
      if ((e as { status?: number })?.status === 400) {
        console.warn('[transcribeVoice] 400 avec keywords/languages, retry bare:', (e as Error)?.message ?? String(e));
        transcription = await createTranscription('bare');
      } else {
        throw e;
      }
    }
    const text = typeof transcription === 'string'
      ? transcription
      : ((transcription as { text?: string })?.text ?? '');
    console.log('[transcribeVoice] User:', uid, `Transcription OK (${TRANSCRIBE_MODEL})`);
    return new Response(JSON.stringify({ text }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    console.error('[transcribeVoice]', (e as Error)?.message ?? String(e));
    return new Response(JSON.stringify({ error: 'Échec de la transcription vocale.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
