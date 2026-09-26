import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables, TablesUpdate } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type Profile = Tables<'profiles'>;
export type ProfileUpdate = Omit<
  TablesUpdate<'profiles'>,
  'id' | 'role' | 'created_at' | 'updated_at'
>;

export const profileKeys = {
  me: (userId: string | undefined) => ['profile', userId] as const,
};

/** The signed-in user's profile (created lazily if the sign-up trigger could not). */
export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: profileKeys.me(user?.id),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Profile> => {
      const userId = user!.id;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
      const meta = user!.user_metadata as Record<string, unknown>;
      const name =
        (meta.display_name as string | undefined) ??
        (meta.full_name as string | undefined) ??
        (meta.name as string | undefined) ??
        user!.email?.split('@')[0] ??
        '';
      const { data: created, error: insertError } = await supabase
        .from('profiles')
        .insert({ id: userId, display_name: name.slice(0, 80) })
        .select('*')
        .single();
      if (insertError) throw insertError;
      return created;
    },
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfileUpdate) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user!.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.me(user?.id), profile);
    },
  });
}

export function useIsAdmin(): boolean {
  const { data } = useProfile();
  return data?.role === 'admin';
}

export interface ProfileCard {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

/** Names/avatars for arbitrary user ids (public attribution, e.g. revision history). */
export function useProfileCards(ids: readonly (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))].sort();
  return useQuery({
    queryKey: ['profile-cards', unique],
    enabled: unique.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_profile_cards', { p_ids: unique });
      if (error) throw error;
      const map = new Map<string, ProfileCard>();
      for (const row of data ?? []) {
        if (row.id) {
          map.set(row.id, {
            id: row.id,
            display_name: row.display_name ?? '',
            avatar_url: row.avatar_url,
          });
        }
      }
      return map;
    },
  });
}
