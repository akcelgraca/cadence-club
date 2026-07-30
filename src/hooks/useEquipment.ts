import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEquipment, createEquipment, updateEquipment, deleteEquipment } from '../services/equipment';
import type { Equipment, EquipmentType } from '../lib/types';

export function useEquipment(userId: string | undefined) {
  return useQuery({
    queryKey: ['equipment', userId],
    queryFn: () => getEquipment(userId!),
    enabled: !!userId,
  });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      user_id: string;
      name: string;
      type: EquipmentType;
      brand?: string;
      model?: string;
      notes?: string;
      initial_distance?: number;
    }) => createEquipment(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['equipment', variables.user_id] });
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: Partial<Pick<Equipment, 'name' | 'type' | 'brand' | 'model' | 'notes' | 'initial_distance' | 'is_retired'>>;
    }) => updateEquipment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEquipment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
}
