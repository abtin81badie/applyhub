import { useQuery } from '@tanstack/react-query';
import type { FunctionReturns } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type MyRoom = FunctionReturns<'list_my_rooms'>[number];

export const roomKeys = {
  all: ['rooms'] as const,
  mine: (userId: string | undefined) => ['rooms', 'mine', userId] as const,
};

/** Rooms I belong to, with my role and counters. */
export function useMyRooms() {
  const { user } = useAuth();
  return useQuery({
    queryKey: roomKeys.mine(user?.id),
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_my_rooms');
      if (error) throw error;
      return data;
    },
  });
}
