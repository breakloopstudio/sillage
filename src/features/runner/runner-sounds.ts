// src/features/runner/runner-sounds.ts — Sons synthétisés pour le mini-jeu

import { useMemo } from 'react';
import { useAudioPlayer } from 'expo-audio';

function encodeWav(samples: number[], sampleRate: number): string {
  const numSamples = samples.length;
  const dataSize = numSamples;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const v = Math.max(0, Math.min(255, Math.floor((samples[i] + 1) * 127.5)));
    view.setUint8(headerSize + i, v);
  }

  const bytes = new Uint8Array(buffer);
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let b64 = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
    b64 += CHARS[a >> 2];
    b64 += CHARS[((a & 3) << 4) | (b >> 4)];
    b64 += i + 1 < bytes.length ? CHARS[((b & 15) << 2) | (c >> 6)] : '=';
    b64 += i + 2 < bytes.length ? CHARS[c & 63] : '=';
  }
  return `data:audio/wav;base64,${b64}`;
}

function generateSweep(freqStart: number, freqEnd: number, duration: number, sampleRate = 11025): string {
  const n = Math.floor(sampleRate * duration);
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const freq = freqStart + (freqEnd - freqStart) * (t / duration);
    const env = 1 - (i / n);
    samples.push(Math.sin(2 * Math.PI * freq * t) * env);
  }
  return encodeWav(samples, sampleRate);
}

function generateDualTone(f1: number, d1: number, f2: number, d2: number, sampleRate = 11025): string {
  const n1 = Math.floor(sampleRate * d1);
  const n2 = Math.floor(sampleRate * d2);
  const samples: number[] = [];
  for (let i = 0; i < n1; i++) {
    const t = i / sampleRate;
    samples.push(Math.sin(2 * Math.PI * f1 * t) * 0.8);
  }
  for (let i = 0; i < n2; i++) {
    const t = i / sampleRate;
    const env = 1 - (i / n2);
    samples.push(Math.sin(2 * Math.PI * f2 * t) * env * 0.9);
  }
  return encodeWav(samples, sampleRate);
}

const JUMP_WAV = generateSweep(180, 400, 0.1);
const PICKUP_WAV = generateDualTone(660, 0.08, 880, 0.1);
const DEATH_WAV = generateSweep(300, 80, 0.2);
const RECORD_WAV = generateDualTone(440, 0.15, 660, 0.25);
const CRACK_WAV = generateSweep(420, 95, 0.09);

export function useRunnerSounds() {
  const jumpPlayer = useAudioPlayer(JUMP_WAV);
  const pickupPlayer = useAudioPlayer(PICKUP_WAV);
  const deathPlayer = useAudioPlayer(DEATH_WAV);
  const recordPlayer = useAudioPlayer(RECORD_WAV);
  const crackPlayer = useAudioPlayer(CRACK_WAV);

  return useMemo(() => ({
    playJump: () => { jumpPlayer.seekTo(0); jumpPlayer.play(); },
    playPickup: () => { pickupPlayer.seekTo(0); pickupPlayer.play(); },
    playDeath: () => { deathPlayer.seekTo(0); deathPlayer.play(); },
    playRecord: () => { recordPlayer.seekTo(0); recordPlayer.play(); },
    playCrack: () => { crackPlayer.seekTo(0); crackPlayer.play(); },
  }), [jumpPlayer, pickupPlayer, deathPlayer, recordPlayer, crackPlayer]);
}
