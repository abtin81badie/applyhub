import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { FunctionReturns, Json, Tables } from '@/lib/database.types';
import type { IntakeTerm, RoomRole, TargetInterest } from '@/lib/domain';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type MyRoom = FunctionReturns<'list_my_rooms'>[number];
export type Room = Tables<'rooms'>;
export type RoomInvite = Tables<'room_invites'>;
export type SharedApplication = FunctionReturns<'get_room_applications'>[number];
export type Note = Tables<'notes'>;
export type Attachment = Tables<'attachments'>;
export type Comment = Tables<'comments'> & {
  author: { id: string; display_name: string; avatar_url: string | null } | null;
};
export type Member = Tables<'room_members'> & {
  profile: { id: string; display_name: string; avatar_url: string | null } | null;
};
export type Target = Tables<'room_targets'> & {
  room_target_votes: { user_id: string; interest: TargetInterest }[];
};

export const BUCKET = 'room-files';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const roomKeys = {
  all: ['rooms'] as const,
  mine: (userId: string | undefined) => ['rooms', 'mine', userId] as const,
  room: (id: string) => ['rooms', id] as const,
  part: (id: string, part: string) => ['rooms', id, part] as const,
};

function unwrap<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw result.error;
  return result.data as NonNullable<T>;
}

/** Rooms I belong to, with my role and counters. */
export function useMyRooms() {
  const { user } = useAuth();
  return useQuery({
    queryKey: roomKeys.mine(user?.id),
    enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.rpc('list_my_rooms')),
  });
}

export function useRoom(roomId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: roomKeys.room(roomId),
    queryFn: async (): Promise<{ room: Room; role: RoomRole } | null> => {
      const { data: room, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle();
      if (error) throw error;
      if (!room) return null;
      const { data: me, error: meError } = await supabase
        .from('room_members')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', user!.id)
        .maybeSingle();
      if (meError) throw meError;
      return { room, role: me?.role ?? 'viewer' };
    },
  });
}

export function useRoomPart<T>(
  roomId: string,
  part: string,
  fetcher: () => Promise<T>,
  enabled = true,
) {
  return useQuery({ queryKey: roomKeys.part(roomId, part), queryFn: fetcher, enabled });
}

export function useRoomMembers(roomId: string) {
  return useRoomPart(
    roomId,
    'members',
    async () =>
      unwrap(
        await supabase
          .from('room_members')
          .select('*, profile:profiles!room_members_user_id_fkey(id, display_name, avatar_url)')
          .eq('room_id', roomId)
          .order('joined_at'),
      ) as unknown as Member[],
  );
}

export function useRoomApplications(roomId: string) {
  return useRoomPart(roomId, 'applications', async () =>
    unwrap(await supabase.rpc('get_room_applications', { p_room_id: roomId })),
  );
}

export function useTargets(roomId: string) {
  return useRoomPart(
    roomId,
    'targets',
    async () =>
      unwrap(
        await supabase
          .from('room_targets')
          .select('*, room_target_votes(user_id, interest)')
          .eq('room_id', roomId)
          .order('created_at', { ascending: false }),
      ) as unknown as Target[],
  );
}

export function useNotes(roomId: string) {
  return useRoomPart(roomId, 'notes', async () =>
    unwrap(
      await supabase
        .from('notes')
        .select('*')
        .eq('room_id', roomId)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false }),
    ),
  );
}

export function useAttachments(roomId: string) {
  return useRoomPart(roomId, 'files', async () =>
    unwrap(
      await supabase
        .from('attachments')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false }),
    ),
  );
}

export function useInvites(roomId: string, enabled: boolean) {
  return useRoomPart(
    roomId,
    'invites',
    async () =>
      unwrap(
        await supabase
          .from('room_invites')
          .select('*')
          .eq('room_id', roomId)
          .is('revoked_at', null)
          .order('created_at', { ascending: false }),
      ),
    enabled,
  );
}

export type CommentTarget =
  | { application_id: string }
  | { note_id: string }
  | { target_id: string }
  | { attachment_id: string };

export function useComments(roomId: string, target: CommentTarget) {
  const [column, id] = Object.entries(target)[0] as [string, string];
  return useQuery({
    queryKey: [...roomKeys.part(roomId, 'comments'), column, id],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('comments')
          .select('*, author:profiles!comments_author_id_fkey(id, display_name, avatar_url)')
          .eq('room_id', roomId)
          .eq(column as 'note_id', id)
          .order('created_at'),
      ) as unknown as Comment[],
  });
}

/** Generic mutation that refreshes everything cached for a room afterwards. */
export function useRoomMutation<V, R = unknown>(roomId: string, fn: (vars: V) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: roomKeys.room(roomId) });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
      void queryClient.invalidateQueries({ queryKey: roomKeys.mine(undefined).slice(0, 2) });
    },
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description: string;
      country: string | null;
      term: IntakeTerm | null;
      year: number | null;
    }) =>
      unwrap(
        await supabase.rpc('create_room', {
          p_name: input.name,
          p_description: input.description,
          ...(input.country ? { p_country_code: input.country } : {}),
          ...(input.term ? { p_intake_term: input.term } : {}),
          ...(input.year ? { p_intake_year: input.year } : {}),
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: roomKeys.all }),
  });
}

export function useJoinRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => unwrap(await supabase.rpc('join_room', { p_code: code })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: roomKeys.all }),
  });
}

export function useInvitePreview(code: string) {
  return useQuery({
    queryKey: ['invite-preview', code],
    queryFn: async () =>
      unwrap(await supabase.rpc('get_invite_preview', { p_code: code }))[0] ?? null,
  });
}

export function inviteLink(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}join/${code}`;
}

/** Signed download URL that expires after 60 seconds. */
export async function signedFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60, { download: true });
  if (error) throw error;
  return data.signedUrl;
}

export function metaText(metadata: Json, key: string): string {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const v = (metadata as Record<string, Json | undefined>)[key];
    return typeof v === 'string' ? v : '';
  }
  return '';
}

/**
 * Live updates: every new activity row in this room (RLS-checked by Realtime)
 * refreshes the room's cached data.
 */
export function useRoomRealtime(roomId: string) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');
  useEffect(() => {
    const channel = supabase
      .channel(`room-activity-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: roomKeys.room(roomId) });
          void queryClient.invalidateQueries({ queryKey: ['activity'] });
        },
      )
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') setStatus('live');
        else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED')
          setStatus('offline');
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, queryClient]);
  return status;
}
