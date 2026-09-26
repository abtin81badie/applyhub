import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';
import type { ApplicationStatus, RequirementKind } from '@/lib/domain';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type Application = Tables<'applications'>;
export type Requirement = Tables<'application_requirements'>;
export type Deadline = Tables<'deadlines'>;
export type ApplicationWithDetails = Application & {
  deadlines: Deadline[];
  application_requirements: Requirement[];
};
export type ApplicationInsert = Omit<TablesInsert<'applications'>, 'user_id'>;
export type ApplicationPatch = Omit<
  TablesUpdate<'applications'>,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>;

const DETAIL_SELECT = '*, deadlines(*), application_requirements(*)';

export const applicationKeys = {
  all: ['applications'] as const,
  list: (userId: string | undefined) => ['applications', 'list', userId] as const,
  detail: (id: string) => ['applications', 'detail', id] as const,
  shares: (id: string) => ['applications', 'shares', id] as const,
};

function sortChildren(app: ApplicationWithDetails): ApplicationWithDetails {
  return {
    ...app,
    deadlines: [...app.deadlines].sort((a, b) => a.due_at.localeCompare(b.due_at)),
    application_requirements: [...app.application_requirements].sort(
      (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
    ),
  };
}

/** All of the signed-in user's applications with deadlines and checklist items. */
export function useApplications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: applicationKeys.list(user?.id),
    enabled: Boolean(user),
    queryFn: async (): Promise<ApplicationWithDetails[]> => {
      const { data, error } = await supabase
        .from('applications')
        .select(DETAIL_SELECT)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data as ApplicationWithDetails[]).map(sortChildren);
    },
  });
}

export function useApplication(id: string | undefined) {
  return useQuery({
    queryKey: applicationKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<ApplicationWithDetails | null> => {
      const { data, error } = await supabase
        .from('applications')
        .select(DETAIL_SELECT)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data ? sortChildren(data as ApplicationWithDetails) : null;
    },
  });
}

function useInvalidateApplications() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: applicationKeys.detail(id) });
  };
}

export interface CreateApplicationInput {
  application: ApplicationInsert;
  requirements?: { kind: RequirementKind; label: string }[];
  deadlines?: { label: string; due_at: string }[];
}

export function useCreateApplication() {
  const invalidate = useInvalidateApplications();
  return useMutation({
    mutationFn: async ({
      application,
      requirements = [],
      deadlines = [],
    }: CreateApplicationInput) => {
      const { data, error } = await supabase
        .from('applications')
        .insert(application)
        .select('id')
        .single();
      if (error) throw error;
      if (requirements.length > 0) {
        const { error: reqError } = await supabase.from('application_requirements').insert(
          requirements.map((r, index) => ({
            ...r,
            application_id: data.id,
            sort_order: index + 1,
          })),
        );
        if (reqError) throw reqError;
      }
      if (deadlines.length > 0) {
        const { error: dlError } = await supabase
          .from('deadlines')
          .insert(deadlines.map((d) => ({ ...d, application_id: data.id })));
        if (dlError) throw dlError;
      }
      return data.id;
    },
    onSuccess: () => invalidate(),
  });
}

export function useUpdateApplication() {
  const invalidate = useInvalidateApplications();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ApplicationPatch }) => {
      const { error } = await supabase.from('applications').update(patch).eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => invalidate(id),
  });
}

/** Status change with an optimistic update of the cached list (Kanban drag & drop). */
export function useUpdateStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const listKey = applicationKeys.list(user?.id);
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ApplicationStatus }) => {
      const { error } = await supabase.from('applications').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<ApplicationWithDetails[]>(listKey);
      queryClient.setQueryData<ApplicationWithDetails[]>(listKey, (apps) =>
        apps?.map((app) => (app.id === id ? { ...app, status } : app)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },
    onSettled: (_data, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      void queryClient.invalidateQueries({ queryKey: applicationKeys.detail(id) });
    },
  });
}

export function useDeleteApplication() {
  const invalidate = useInvalidateApplications();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('applications').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

// ------------------------------------------------------------ requirements --
export function useAddRequirements(applicationId: string) {
  const invalidate = useInvalidateApplications();
  return useMutation({
    mutationFn: async (items: { kind: RequirementKind; label: string; sort_order?: number }[]) => {
      const { error } = await supabase
        .from('application_requirements')
        .insert(items.map((item) => ({ ...item, application_id: applicationId })));
      if (error) throw error;
    },
    onSuccess: () => invalidate(applicationId),
  });
}

export function useUpdateRequirement(applicationId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateApplications();
  const detailKey = applicationKeys.detail(applicationId);
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<Requirement, 'is_done' | 'label' | 'kind' | 'notes' | 'sort_order'>>;
    }) => {
      const { error } = await supabase.from('application_requirements').update(patch).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<ApplicationWithDetails | null>(detailKey);
      if (previous) {
        queryClient.setQueryData<ApplicationWithDetails>(detailKey, {
          ...previous,
          application_requirements: previous.application_requirements.map((r) =>
            r.id === id ? { ...r, ...patch } : r,
          ),
        });
      }
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(detailKey, context.previous);
    },
    onSettled: () => invalidate(applicationId),
  });
}

export function useDeleteRequirement(applicationId: string) {
  const invalidate = useInvalidateApplications();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('application_requirements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(applicationId),
  });
}

// --------------------------------------------------------------- deadlines --
export function useSaveDeadline(applicationId: string) {
  const invalidate = useInvalidateApplications();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      label: string;
      due_at: string;
      is_done?: boolean;
      notes?: string | null;
    }) => {
      if (input.id) {
        const { id, ...patch } = input;
        const { error } = await supabase.from('deadlines').update(patch).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('deadlines')
          .insert({ ...input, application_id: applicationId });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidate(applicationId),
  });
}

export function useDeleteDeadline(applicationId: string) {
  const invalidate = useInvalidateApplications();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deadlines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(applicationId),
  });
}

// ----------------------------------------------------------------- sharing --
/** Rooms this application is currently shared into. */
export function useApplicationShares(applicationId: string | undefined) {
  return useQuery({
    queryKey: applicationKeys.shares(applicationId ?? ''),
    enabled: Boolean(applicationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_shared_applications')
        .select('room_id, shared_at')
        .eq('application_id', applicationId!);
      if (error) throw error;
      return data.map((row) => row.room_id);
    },
  });
}

export function useSetSharing(applicationId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateApplications();
  return useMutation({
    mutationFn: async (roomIds: string[]) => {
      const { error } = await supabase.rpc('set_application_sharing', {
        p_application_id: applicationId,
        p_room_ids: roomIds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(applicationId);
      void queryClient.invalidateQueries({ queryKey: applicationKeys.shares(applicationId) });
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}
