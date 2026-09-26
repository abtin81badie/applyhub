import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@/lib/database.types';
import type { KbEntity } from '@/lib/domain';
import { supabase } from '@/lib/supabase';

export type GuideSectionRow = Tables<'country_guides'>;
export type CountryLink = Tables<'country_links'>;
export type DirectoryRow = Tables<'university_directory'>;
export type University = Tables<'universities'>;
export type Program = Tables<'programs'> & {
  program_requirements: Tables<'program_requirements'>[];
  program_deadlines: Tables<'program_deadlines'>[];
};
export type Revision = Tables<'kb_revisions'>;

async function run<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export function useUniversityCounts() {
  return useQuery({
    queryKey: ['kb', 'university-counts'],
    queryFn: async () => {
      const rows = await run(supabase.from('universities').select('country_code'));
      const counts = new Map<string, number>();
      for (const row of rows ?? [])
        counts.set(row.country_code, (counts.get(row.country_code) ?? 0) + 1);
      return counts;
    },
  });
}

export function useCountryGuide(code: string) {
  return useQuery({
    queryKey: ['kb', 'guide', code],
    queryFn: () => run(supabase.from('country_guides').select('*').eq('country_code', code)),
  });
}

export function useCountryLinks(code: string) {
  return useQuery({
    queryKey: ['kb', 'links', code],
    queryFn: () =>
      run(supabase.from('country_links').select('*').eq('country_code', code).order('sort_order')),
  });
}

export function useDirectory(code: string) {
  return useQuery({
    queryKey: ['kb', 'directory', code],
    queryFn: () =>
      run(
        supabase.from('university_directory').select('*').eq('country_code', code).order('name_en'),
      ),
  });
}

export function useUniversity(id: string) {
  return useQuery({
    queryKey: ['kb', 'university', id],
    queryFn: async () => {
      const university = await run(
        supabase.from('universities').select('*').eq('id', id).maybeSingle(),
      );
      if (!university) return null;
      const programs = (await run(
        supabase
          .from('programs')
          .select('*, program_requirements(*), program_deadlines(*)')
          .eq('university_id', id)
          .order('name_en'),
      )) as Program[];
      return { university, programs };
    },
  });
}

export function useProgramUniversity(programId: string) {
  return useQuery({
    queryKey: ['kb', 'program-university', programId],
    queryFn: async () =>
      (
        await run(
          supabase.from('programs').select('university_id').eq('id', programId).maybeSingle(),
        )
      )?.university_id ?? null,
  });
}

export function useRevisions(entity: KbEntity, id: string) {
  return useQuery({
    queryKey: ['kb', 'revisions', entity, id],
    queryFn: () =>
      run(
        supabase
          .from('kb_revisions')
          .select('*')
          .eq('entity_type', entity)
          .eq('entity_id', id)
          .order('changed_at', { ascending: false })
          .limit(100),
      ),
  });
}

/** One-click "add to tracker" (copies program facts, requirements and upcoming deadlines). */
export function useAddToTracker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { programId?: string; universityId?: string; locale: string }) =>
      run(
        supabase.rpc('add_to_tracker', {
          ...(input.programId ? { p_program_id: input.programId } : {}),
          ...(input.universityId ? { p_university_id: input.universityId } : {}),
          p_locale: input.locale,
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['applications'] }),
  });
}
