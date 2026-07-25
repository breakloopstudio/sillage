// src/services/impl/storage.supabase.ts — Upload d'images vers Supabase Storage
// (bucket public `parfum-images`). Appelée par le dispatcher storage.ts quand
// USE_SUPABASE=true.

import * as FileSystem from 'expo-file-system';
import { supabase } from '../supabase';

export async function uploadParfumImage(
  parfumId: string,
  localUri: string,
  filename?: string,
): Promise<string> {
  try {
    const name = filename ?? `image_${Date.now()}.webp`;
    const filePath = `parfums/${parfumId}_${Date.now()}_${name}`;

    // Lire le fichier local en base64 (expo-file-system) puis décoder vers
    // Uint8Array — supabase-js .upload accepte ArrayBuffer/Uint8Array sur RN.
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binaryStr = atob(base64);
    const buffer = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      buffer[i] = binaryStr.charCodeAt(i);
    }

    const { error } = await supabase.storage
      .from('parfum-images')
      .upload(filePath, buffer, { contentType: 'image/webp', upsert: true });
    if (error) throw error;

    const { data } = supabase.storage.from('parfum-images').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (e: unknown) {
    console.warn('[storage] uploadParfumImage failed:', (e as Error)?.message ?? String(e));
    throw e;
  }
}
