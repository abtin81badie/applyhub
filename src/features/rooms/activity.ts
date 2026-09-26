import { useQuery } from '@tanstack/react-query';
import type { Json, Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type ActivityRow = Tables<'activity_log'> & {
  actor: { id: string; display_name: string; avatar_url: string | null } | null;
  room?: { id: string; name: string } | null;
};

export const activityKeys = {
  recent: (userId: string | undefined) => ['activity', 'recent', userId] as const,
  room: (roomId: string) => ['activity', 'room', roomId] as const,
};

const SELECT = '*, actor:profiles!activity_log_actor_id_fkey(id, display_name, avatar_url)';

/** Latest activity across all my rooms (RLS limits rows to rooms I belong to). */
export function useRecentActivity(limit = 12) {
  const { user } = useAuth();
  return useQuery({
    queryKey: activityKeys.recent(user?.id),
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_log')
        .select(`${SELECT}, room:rooms!activity_log_room_id_fkey(id, name)`)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as ActivityRow[];
    },
  });
}

export function useRoomActivity(roomId: string, limit = 100) {
  return useQuery({
    queryKey: activityKeys.room(roomId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_log')
        .select(SELECT)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as ActivityRow[];
    },
  });
}

export function metaString(metadata: Json, key: string): string {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, Json | undefined>)[key];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  }
  return '';
}
