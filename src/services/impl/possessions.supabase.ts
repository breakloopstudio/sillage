import type { Possession, PossessionType } from '../../models/user-parfum.interface';
import { supabase } from '../supabase';
import { toDate } from './sql-utils';

function rowToPossession(row: Record<string, unknown>): Possession {
  return {
    id: row.id as string,
    parfumId: row.parfum_id as string,
    type: (row.type as PossessionType) ?? 'bottle',
    sizeMl: typeof row.size_ml === 'number' ? row.size_ml : null,
    quantity: typeof row.quantity === 'number' ? row.quantity : 1,
    forSale: row.for_sale === true,
    notes: (row.notes as string) ?? null,
    addedAt: toDate(row.added_at) ?? new Date(),
  };
}

export async function getPossessions(uid: string, parfumId: string): Promise<Possession[]> {
  try {
    const { data, error } = await supabase
      .from('possessions')
      .select('*')
      .eq('user_id', uid)
      .eq('parfum_id', parfumId)
      .order('added_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => rowToPossession(r as Record<string, unknown>));
  } catch (e: unknown) {
    console.warn('[possessions] getPossessions failed:', (e as Error)?.message ?? String(e));
    return [];
  }
}

export async function addPossession(
  uid: string,
  parfumId: string,
  type: PossessionType,
  sizeMl?: number | null,
  quantity?: number,
  forSale?: boolean,
  notes?: string | null,
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('possessions')
      .insert({
        user_id: uid,
        parfum_id: parfumId,
        type,
        size_ml: sizeMl ?? null,
        quantity: quantity ?? 1,
        for_sale: forSale ?? false,
        notes: notes ?? null,
        added_at: new Date().toISOString(),
      } as never)
      .select('id')
      .single();
    if (error) throw error;
    return (data as { id: string }).id;
  } catch (e: unknown) {
    console.warn('[possessions] addPossession failed:', (e as Error)?.message ?? String(e));
    return '';
  }
}

export async function updatePossession(
  uid: string,
  possessionId: string,
  data: Partial<Pick<Possession, 'type' | 'sizeMl' | 'quantity' | 'forSale' | 'notes'>>,
): Promise<void> {
  try {
    const row: Record<string, unknown> = {};
    if (data.type !== undefined) row.type = data.type;
    if (data.sizeMl !== undefined) row.size_ml = data.sizeMl;
    if (data.quantity !== undefined) row.quantity = data.quantity;
    if (data.forSale !== undefined) row.for_sale = data.forSale;
    if (data.notes !== undefined) row.notes = data.notes;
    const { error } = await supabase
      .from('possessions')
      .update(row as never)
      .eq('user_id', uid)
      .eq('id', possessionId);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[possessions] updatePossession failed:', (e as Error)?.message ?? String(e));
  }
}

export async function removePossession(uid: string, possessionId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('possessions')
      .delete()
      .eq('user_id', uid)
      .eq('id', possessionId);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[possessions] removePossession failed:', (e as Error)?.message ?? String(e));
  }
}
