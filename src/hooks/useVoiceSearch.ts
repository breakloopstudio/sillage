import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import * as FileSystem from 'expo-file-system';
import i18next from 'i18next';
import { deviceSttLang } from '../utils/device-locale';

// Biasing STT on-device (contextualStrings) : marques + top noms de parfums.
// ⚠️ Miroir ASCII des listes serveur (supabase/functions/transcribe-voice et
// interpret-voice-query) — le STT on-device préfère l'ASCII (« Lancome »).
// Sans les noms de parfums, l'ASR français écorche les noms propres inconnus
// (« Aventus » → « prix d'avant »). Liste rejouable : scripts/voice-vocab.ts.
const TOP_BRANDS = [
  'Dolce&Gabbana', 'Mugler', 'Lancome', 'Yves Saint Laurent',
  'Dior', 'Chanel', 'Tom Ford', 'Versace',
  'Maison Francis Kurkdjian', 'Lattafa Perfumes', 'Hermes', 'Armaf',
  'Creed', 'Jean Paul Gaultier', 'Maison Martin Margiela', 'Carolina Herrera',
  'Giorgio Armani', 'Lalique', 'Rabanne', 'Chloe',
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
  'Escentric Molecules', 'Initio Parfums Prives', 'Estee Lauder', 'Jimmy Choo',
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
  'Zara', 'Stephane Humbert Lucas 777', 'Goldfield & Banks Australia', 'Nobile 1942',
  'Histoires de Parfums', 'DSQUARED2', 'Beyonce', 'Phlur',
  'PARIS CORNER', 'Zoologist Perfumes', 'Missoni', 'Maison Alhambra',
  'Ted Lapidus', 'Room 1015', 'Boucheron', 'Caron',
  'Natura', 'Jovoy Paris', 'Loewe', 'Tiffany',
  'Khadlaj Perfumes', 'Imaginary Authors', 'M. Micallef', 'Clive Christian',
  'Carner Barcelona', 'Michael Kors', 'Arabiyat Prestige', 'Bond No 9',
  'O Boticario', 'Karl Lagerfeld', 'Fendi', 'Dries Van Noten',
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
  'Be Layered', 'Henry Jacques', 'Welton London', 'Stephanie de Bruijn - Parfum sur Mesure',
  'Aeropostale', 'Caswell Massey', 'Bastide Aix en Provence', 'Soul Of Mine',
  'Stellar Scents', 'Santa Eulalia', 'Acidica Perfumes', 'Tayshaba',
  'Bargello',
];

// Top ~100 noms de parfums par popularité (scripts/voice-vocab.ts).
const TOP_PERFUME_NAMES = [
  'Light Blue', 'Alien', 'La Vie Est Belle', 'Angel',
  'Black Opium', 'Sauvage', 'Coco Mademoiselle', 'Black Orchid',
  'Tobacco Vanille', 'Hypnotic Poison', 'Eros', 'J\'adore',
  'Baccarat Rouge 540', 'Khamrah', 'Terre d\'Hermes', 'Club de Nuit Intense Man',
  'Y Eau de Parfum', 'Aventus', 'Le Male Le Parfum', 'By the Fireplace',
  'Good Girl', 'Acqua di Gio', 'Le Male Elixir', 'Versace Pour Homme Dylan Blue',
  'Le Male', 'Encre Noire', 'Emporio Armani Stronger With You Intensely', 'Crystal Noir',
  'Dior Homme Intense 2011', 'La Nuit de l\'Homme', 'Bright Crystal', '1 Million',
  'Chloe Eau de Parfum', 'Euphoria', 'Angels\' Share', 'Fahrenheit',
  'CK One', 'Bleu de Chanel Eau de Parfum', 'Versace Pour Homme', 'Libre',
  'Flowerbomb', 'Bleu de Chanel', 'Jazz Club', 'Narciso Rodriguez For Her',
  'Cool Water', 'XJ 1861 Naxos', 'Chance Eau Tendre', 'Si',
  'L\'Eau d\'Issey Pour Homme', 'D&G Anthology L\'Imperatrice 3', 'Eros Flame', 'Sauvage Elixir',
  'Shalimar Eau de Parfum', 'Layton', 'Bal d\'Afrique', 'Ombre Leather',
  'Le Beau Le Parfum', 'Lost Cherry', 'Eclat d\'Arpege', '9pm',
  'Pure Poison', 'Cloud', 'DKNY Be Delicious', 'Ultra Male',
  'Oud Wood', 'The One', 'Explorer', 'Acqua di Gioia',
  'Spicebomb Extreme', 'Versace Man Eau Fraiche', 'Prada Candy', 'Fantasy',
  'Acqua di Gio Profumo', 'Green Tea', 'Prada L\'Homme', 'Mon Guerlain',
  'Poison', 'Flower by Kenzo', 'The One for Men Eau de Parfum', 'Burberry Her',
  'Wood Sage & Sea Salt', 'Allure Homme Sport', 'Chance Eau Fraiche', 'Hypnose',
  'Dior Addict', 'Nina', 'Un Jardin Sur Le Nil', 'Invictus',
  'Bois Imperial', 'Khamrah Qahwa', 'Amor Amor', 'Miracle',
  'Not A Perfume', 'Armani Code for Women', 'Olympea', 'The One for Men',
  'L\'Interdit Eau de Parfum', 'Lady Million', 'Sauvage Eau de Parfum', 'Grand Soir',
];

const CONTEXTUAL_STRINGS = [...TOP_BRANDS, ...TOP_PERFUME_NAMES];

// Nombre d'hypothèses de transcription demandées au STT : les alternatives
// contiennent souvent la bonne orthographe d'un nom propre écorché — elles sont
// livrées avec le transcript et envoyées à l'interprétation LLM.
const MAX_ALTERNATIVES = 4;
const MAX_COLLECTED_ALTERNATIVES = 8;

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

/** Codes d'erreur livrés à onError (2ᵉ argument) — l'UI adapte la sortie
 *  (ex. bouton « Réglages » quand le micro est refusé définitivement). */
export type VoiceErrorCode = 'mic-denied' | 'mic-denied-permanent';

export interface VoiceResult {
  text?: string;
  audioBase64?: string;
  /** URI du fichier audio persisté (seconde chance Whisper si le match est
   *  faible). Le fichier vit jusqu'au prochain start/cancel. */
  audioUri?: string;
  /** Hypothèses de transcription alternatives (maxAlternatives) — envoyées à
   *  l'interprétation LLM pour récupérer les noms propres écorchés. */
  alternatives?: string[];
}

const MAX_RECORDING_DURATION_MS = 15_000;

const GRACEFUL_ERRORS: readonly string[] = [
  'no-speech',
  'speech-timeout',
  'aborted',
];

// Locale appareil non supportée par le moteur STT (modèle non téléchargé,
// langue rare) → un seul retry avec la locale fallback universelle.
const LANGUAGE_FALLBACK_ERRORS: readonly string[] = [
  'language-not-supported',
  'language-unavailable',
];
const FALLBACK_STT_LANG = 'en-US';

type VoiceStartOpts = { continuous?: boolean; langOverride?: string };

export function useVoiceSearch(
  onResult: (result: VoiceResult) => void,
  onError?: (msg: string, code?: VoiceErrorCode) => void,
) {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');

  const sessionIdRef = useRef(0);
  const audioUriRef = useRef<string | null>(null);
  const alternativesRef = useRef<string[]>([]);
  const finalTranscriptRef = useRef('');
  const finalizingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const startPendingRef = useRef(false);
  const stoppingRef = useRef(false);
  const langFallbackRef = useRef(false);
  const lastContinuousRef = useRef(false);
  const startRef = useRef<(opts?: VoiceStartOpts) => Promise<void>>(() => Promise.resolve());

  const deliverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxDurationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const clearTimers = useCallback(() => {
    if (deliverTimeoutRef.current) { clearTimeout(deliverTimeoutRef.current); deliverTimeoutRef.current = null; }
    if (maxDurationRef.current) { clearTimeout(maxDurationRef.current); maxDurationRef.current = null; }
  }, []);

  const deliverResult = useCallback(() => {
    clearTimers();
    if (!finalizingRef.current) return;
    finalizingRef.current = false;
    stopRequestedRef.current = false;

    const finalText = finalTranscriptRef.current.trim();
    sessionIdRef.current = 0;
    setState('idle');

    if (finalText) {
      // L'URI audio est livrée avec le texte (le fichier reste sur disque
      // jusqu'au prochain start/cancel) — seconde chance si le match est faible.
      // Les hypothèses alternatives alimentent l'interprétation LLM.
      try {
        onResultRef.current({
          text: finalText,
          audioUri: audioUriRef.current ?? undefined,
          alternatives: alternativesRef.current.length > 0 ? alternativesRef.current : undefined,
        });
      } catch (err: unknown) {
        if (__DEV__) console.warn('[useVoiceSearch] onResult() threw:', (err as Error)?.message ?? String(err));
      }
    } else if (audioUriRef.current) {
      const uri = audioUriRef.current;
      audioUriRef.current = null;
      FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
        .then(base64 => {
          try {
            onResultRef.current({ audioBase64: base64, audioUri: uri });
          } catch (err: unknown) {
            if (__DEV__) console.warn('[useVoiceSearch] onResult(audio) threw:', (err as Error)?.message ?? String(err));
          }
        })
        .catch((err: unknown) => {
          console.warn('[useVoiceSearch] Failed to read audio file:', (err as Error)?.message ?? String(err));
          onErrorRef.current?.(i18next.t('voice.errorReadAudio'));
        })
        .finally(() => {
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        });
    } else {
      onErrorRef.current?.(i18next.t('voice.errorNoSpeech'));
    }
  }, [clearTimers]);

  const finalize = useCallback(() => {
    if (finalizingRef.current || sessionIdRef.current === 0) return;
    finalizingRef.current = true;
    stoppingRef.current = false;
    setState('processing');
    clearTimers();
    deliverTimeoutRef.current = setTimeout(() => {
      deliverResult();
    }, 800);
  }, [clearTimers, deliverResult]);

  useSpeechRecognitionEvent('start', () => {
    if (sessionIdRef.current === 0) return;
    startPendingRef.current = false;
    if (stopRequestedRef.current) {
      stoppingRef.current = true;
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    setState('listening');
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (sessionIdRef.current === 0) return;
    const text = event.results[0]?.transcript || '';

    if (event.isFinal) {
      // Hypothèses alternatives (maxAlternatives) : la bonne orthographe d'un
      // nom propre écorché s'y trouve souvent. Collecte best-effort, dédupliquée.
      for (let i = 1; i < event.results.length; i++) {
        const alt = (event.results[i]?.transcript || '').trim();
        if (alt.length >= 2 && alternativesRef.current.length < MAX_COLLECTED_ALTERNATIVES
          && !alternativesRef.current.some(x => x.toLowerCase() === alt.toLowerCase())) {
          alternativesRef.current.push(alt);
        }
      }
      const newSegment = text.trim();
      const prev = finalTranscriptRef.current;
      if (prev && newSegment && newSegment.includes(prev)) {
        // Moteur cumulatif : le segment contient déjà l'accumulé → remplacer.
        finalTranscriptRef.current = newSegment;
      } else if (prev && newSegment && !prev.includes(newSegment)) {
        finalTranscriptRef.current = prev + ' ' + newSegment;
      } else if (!prev || !newSegment) {
        finalTranscriptRef.current = finalTranscriptRef.current || newSegment;
      }
      finalTranscriptRef.current = finalTranscriptRef.current.trim();
      setTranscript(finalTranscriptRef.current);

      if (finalizingRef.current) {
        deliverResult();
      }
    } else {
      setTranscript(text.trim());
    }
  });

  useSpeechRecognitionEvent('audioend', (event) => {
    if (sessionIdRef.current === 0) return;
    if (event.uri) {
      audioUriRef.current = event.uri;
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (sessionIdRef.current === 0) return;
    const code = event.error;
    const msg = event.message || i18next.t('voice.recognitionError');

    if (GRACEFUL_ERRORS.includes(code)) {
      return;
    }

    // Locale appareil non supportée → un seul retry en en-US (multilingue :
    // mieux vaut une transcription anglaise qu'une erreur sèche).
    if (LANGUAGE_FALLBACK_ERRORS.includes(code) && !langFallbackRef.current) {
      langFallbackRef.current = true;
      finalizingRef.current = false;
      sessionIdRef.current = 0;
      stopRequestedRef.current = false;
      startPendingRef.current = false;
      stoppingRef.current = false;
      clearTimers();
      void startRef.current({ continuous: lastContinuousRef.current, langOverride: FALLBACK_STT_LANG });
      return;
    }

    finalizingRef.current = false;
    sessionIdRef.current = 0;
    stopRequestedRef.current = false;
    startPendingRef.current = false;
    stoppingRef.current = false;
    clearTimers();
    setState('error');
    onErrorRef.current?.(msg);
  });

  // nomatch : parole détectée mais non reconnue — le flux continue vers 'end' →
  // finalize() qui livrera l'audio (fallback Whisper) ou « Aucune parole détectée. ».
  useSpeechRecognitionEvent('nomatch', () => {
    if (sessionIdRef.current === 0) return;
  });

  useSpeechRecognitionEvent('end', () => {
    if (sessionIdRef.current === 0) return;
    stoppingRef.current = false;
    finalize();
  });

  const start = useCallback(async (opts?: VoiceStartOpts) => {
    if (startPendingRef.current) return;

    try {
      startPendingRef.current = true;
      stopRequestedRef.current = false;
      lastContinuousRef.current = opts?.continuous ?? false;
      // Nouveau départ initié par l'utilisateur (pas un retry fallback) :
      // réarme le droit à un seul repli de langue.
      if (!opts?.langOverride) langFallbackRef.current = false;
      clearTimers();

      if (sessionIdRef.current !== 0) {
        sessionIdRef.current = 0;
        try { ExpoSpeechRecognitionModule.abort(); } catch { /* cleanup */ }
        await new Promise(r => setTimeout(r, 80));
      }

      finalizingRef.current = false;
      stoppingRef.current = false;
      setState('idle');
      finalTranscriptRef.current = '';
      alternativesRef.current = [];
      if (audioUriRef.current) {
        FileSystem.deleteAsync(audioUriRef.current, { idempotent: true }).catch(() => {});
        audioUriRef.current = null;
      }
      setTranscript('');

      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        startPendingRef.current = false;
        setState('error');
        if (!perm.canAskAgain) {
          onErrorRef.current?.(i18next.t('voice.micDisabledPermanent'), 'mic-denied-permanent');
        } else {
          onErrorRef.current?.(i18next.t('voice.micDenied'), 'mic-denied');
        }
        return;
      }

      sessionIdRef.current = Date.now();

      Promise.resolve(ExpoSpeechRecognitionModule.start({
        // Langue de l'appareil (multilingue) — plus de FR forcé ; repli en-US
        // si la locale n'est pas supportée par le moteur.
        lang: opts?.langOverride ?? deviceSttLang(),
        interimResults: true,
        continuous: opts?.continuous ?? false,
        contextualStrings: CONTEXTUAL_STRINGS,
        maxAlternatives: MAX_ALTERNATIVES,
        recordingOptions: { persist: true as const },
      })).catch((e: unknown) => {
        console.warn('[useVoiceSearch] module.start rejected:', (e as Error)?.message ?? String(e));
        startPendingRef.current = false;
        sessionIdRef.current = 0;
        setState('error');
        onErrorRef.current?.(i18next.t('voice.errorStart'));
      });

      // Auto-stop à 15 s : haptique légère (fin d'enregistrement, pas un achèvement §2.6).
      maxDurationRef.current = setTimeout(() => {
        if (sessionIdRef.current === 0) return;
        stopRequestedRef.current = true;
        ExpoSpeechRecognitionModule.stop();
      }, MAX_RECORDING_DURATION_MS);
    } catch (err: unknown) {
      startPendingRef.current = false;
      sessionIdRef.current = 0;
      clearTimers();
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* cleanup */ }
      const msg = err instanceof Error ? err.message : i18next.t('voice.errorUnknown');
      console.warn('[useVoiceSearch] start() failed:', msg);
      setState('error');
      onErrorRef.current?.(msg);
    }
  }, [clearTimers]);

  startRef.current = start;

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    if (sessionIdRef.current !== 0 && !stoppingRef.current) {
      stoppingRef.current = true;
      ExpoSpeechRecognitionModule.stop();
    }
  }, []);

  const cancel = useCallback(() => {
    stopRequestedRef.current = false;
    finalizingRef.current = false;
    startPendingRef.current = false;
    stoppingRef.current = false;
    clearTimers();
    if (sessionIdRef.current !== 0) {
      sessionIdRef.current = 0;
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* cleanup */ }
    }
    if (audioUriRef.current) {
      FileSystem.deleteAsync(audioUriRef.current, { idempotent: true }).catch(() => {});
      audioUriRef.current = null;
    }
    setState('idle');
    setTranscript('');
    finalTranscriptRef.current = '';
    alternativesRef.current = [];
  }, [clearTimers]);

  useEffect(() => {
    return () => {
      sessionIdRef.current = 0;
      finalizingRef.current = false;
      stopRequestedRef.current = false;
      startPendingRef.current = false;
      stoppingRef.current = false;
      clearTimers();
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* cleanup */ }
      if (audioUriRef.current) {
        FileSystem.deleteAsync(audioUriRef.current, { idempotent: true }).catch(() => {});
        audioUriRef.current = null;
      }
    };
  }, [clearTimers]);

  return { state, transcript, start, stop, cancel } as const;
}
