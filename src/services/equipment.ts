import { supabase } from './supabase';
import type { Equipment, EquipmentType } from '../lib/types';

export async function getEquipment(userId: string): Promise<Equipment[]> {
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createEquipment(data: {
  user_id: string;
  name: string;
  type: EquipmentType;
  brand?: string;
  model?: string;
  notes?: string;
  initial_distance?: number;
}): Promise<Equipment> {
  const { data: equipment, error } = await supabase
    .from('equipment')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return equipment;
}

export async function updateEquipment(
  id: string,
  data: Partial<Pick<Equipment, 'name' | 'type' | 'brand' | 'model' | 'notes' | 'initial_distance' | 'is_retired'>>
): Promise<Equipment> {
  const { data: equipment, error } = await supabase
    .from('equipment')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return equipment;
}

export async function deleteEquipment(id: string): Promise<void> {
  const { error } = await supabase
    .from('equipment')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
