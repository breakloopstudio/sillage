import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import * as FileSystem from 'expo-file-system';
import { hapticsSuccess } from '../services/haptics';

const TOP_BRANDS = [
  'Dior', 'Chanel', 'Guerlain', 'Yves Saint Laurent', 'Lancome',
  'Hermes', 'Jean Paul Gaultier', 'Paco Rabanne', 'Givenchy',
  'Versace', 'Armani', 'Tom Ford', 'Calvin Klein',
  'Hugo Boss', 'Burberry', 'Carolina Herrera', 'Dolce Gabbana',
  'Bvlgari', 'Acqua di Parma', 'Maison Francis Kurkdjian',
  'Creed', 'Xerjoff', 'Parfums de Marly', 'Amouage', 'By Kilian',
  'Initio', 'Nishane', 'Mancera', 'Montale', 'Roja',
  'Le Labo', 'Byredo', 'Diptyque', 'Jo Malone', 'Maison Margiela',
  'Valentino', 'Prada', 'Azzaro', 'Davidoff', 'Issey Miyake',
  'Kenzo', 'Nina Ricci', 'Mugler', 'Cacharel', 'Cartier', 'Lalique',
];

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

export interface VoiceResult {
  text?: string;
  audioBase64?: string;
}

const MAX_RECORDING_DURATION_MS = 15_000;

const GRACEFUL_ERRORS: readonly string[] = [
  'no-speech',
  'speech-timeout',
  'aborted',
];

export function useVoiceSearch(
  onResult: (result: VoiceResult) => void,
  onError?: (msg: string) => void,
) {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');

  const sessionIdRef = useRef(0);
  const audioUriRef = useRef<string | null>(null);
  const finalTranscriptRef = useRef('');
  const finalizingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const startPendingRef = useRef(false);
  const stoppingRef = useRef(false);

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
      try {
        onResultRef.current({ text: finalText });
      } catch (err: unknown) {
        if (__DEV__) console.warn('[useVoiceSearch] onResult() threw:', (err as Error)?.message ?? String(err));
      }
    } else if (audioUriRef.current) {
      const uri = audioUriRef.current;
      audioUriRef.current = null;
      FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
        .then(base64 => {
          try {
            onResultRef.current({ audioBase64: base64 });
          } catch (err: unknown) {
            if (__DEV__) console.warn('[useVoiceSearch] onResult(audio) threw:', (err as Error)?.message ?? String(err));
          }
        })
        .catch((err: unknown) => {
          console.warn('[useVoiceSearch] Failed to read audio file:', (err as Error)?.message ?? String(err));
          onErrorRef.current?.('Impossible de lire l\'enregistrement audio.');
        })
        .finally(() => {
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        });
    } else {
      onErrorRef.current?.('Aucune parole détectée.');
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
      const newSegment = text.trim();
      const prev = finalTranscriptRef.current;
      if (prev && newSegment && !prev.includes(newSegment)) {
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
    const msg = event.message || 'Erreur de reconnaissance vocale.';

    if (GRACEFUL_ERRORS.includes(code)) {
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

  useSpeechRecognitionEvent('nomatch', () => {
    if (sessionIdRef.current === 0) return;
  });

  useSpeechRecognitionEvent('end', () => {
    if (sessionIdRef.current === 0) return;
    stoppingRef.current = false;
    finalize();
  });

  const start = useCallback(async (opts?: { continuous?: boolean }) => {
    if (startPendingRef.current) return;

    try {
      startPendingRef.current = true;
      stopRequestedRef.current = false;
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
      if (audioUriRef.current) {
        FileSystem.deleteAsync(audioUriRef.current, { idempotent: true }).catch(() => {});
        audioUriRef.current = null;
      }
      setTranscript('');

      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        startPendingRef.current = false;
        setState('error');
        onErrorRef.current?.('Accès au micro refusé. Vérifiez les paramètres de confidentialité.');
        return;
      }

      sessionIdRef.current = Date.now();

      Promise.resolve(ExpoSpeechRecognitionModule.start({
        lang: 'fr-FR',
        interimResults: true,
        continuous: opts?.continuous ?? false,
        contextualStrings: TOP_BRANDS,
        recordingOptions: { persist: true as const },
      })).catch((e: unknown) => {
        console.warn('[useVoiceSearch] module.start rejected:', (e as Error)?.message ?? String(e));
        startPendingRef.current = false;
        setState('error');
      });

      maxDurationRef.current = setTimeout(() => {
        if (sessionIdRef.current === 0) return;
        stopRequestedRef.current = true;
        hapticsSuccess();
        ExpoSpeechRecognitionModule.stop();
      }, MAX_RECORDING_DURATION_MS);
    } catch (err: unknown) {
      startPendingRef.current = false;
      sessionIdRef.current = 0;
      clearTimers();
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* cleanup */ }
      const msg = err instanceof Error ? err.message : 'Erreur inconnue.';
      console.warn('[useVoiceSearch] start() failed:', msg);
      setState('error');
      onErrorRef.current?.(msg);
    }
  }, [clearTimers]);

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
