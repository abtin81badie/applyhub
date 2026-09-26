import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Markdown } from '@/components/common/Markdown';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { describeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useFormat } from '@/providers/PreferencesProvider';
import { useToast } from '@/providers/ToastProvider';
import { useComments, useRoomMutation, type CommentTarget } from './api';

/** Comment thread on a shared application, note, target or file. */
export function Comments({
  roomId,
  target,
  canWrite,
  isOwner,
}: {
  roomId: string;
  target: CommentTarget;
  canWrite: boolean;
  isOwner: boolean;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fmt = useFormat();
  const toast = useToast();
  const { data: comments = [] } = useComments(roomId, target);
  const [body, setBody] = useState('');
  const onError = (e: unknown) => toast.error(describeError(e, t));
  const add = useRoomMutation(roomId, async (text: string) => {
    const { error } = await supabase
      .from('comments')
      .insert({ room_id: roomId, body: text, ...target });
    if (error) throw error;
  });
  const remove = useRoomMutation(roomId, async (id: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) throw error;
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    add.mutate(body.trim(), { onSuccess: () => setBody(''), onError });
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <p className="text-xs font-semibold text-muted">
        {t('rooms.comments.count', { count: comments.length })}
      </p>
      {comments.map((c) => (
        <div key={c.id} className="group flex gap-2">
          <Avatar
            name={c.author?.display_name}
            url={c.author?.avatar_url}
            seed={c.author_id}
            size="xs"
            className="mt-1"
          />
          <div className="min-w-0 flex-1 rounded-lg bg-surface-2 px-3 py-2">
            <p className="text-xs text-muted">
              <span className="font-medium text-fg">
                {c.author?.display_name || t('common.someone')}
              </span>{' '}
              · {fmt.relative(c.created_at)}
            </p>
            <Markdown className="text-sm">{c.body}</Markdown>
          </div>
          {(c.author_id === user?.id || isOwner) && (
            <button
              type="button"
              className="self-start rounded p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
              aria-label={t('common.delete')}
              onClick={() => remove.mutate(c.id, { onError })}
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      ))}
      {canWrite && (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <Textarea
            dir="auto"
            rows={2}
            maxLength={5000}
            value={body}
            placeholder={t('rooms.comments.placeholder')}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            className="self-end"
            loading={add.isPending}
            disabled={!body.trim()}
          >
            {t('common.send')}
          </Button>
        </form>
      )}
    </div>
  );
}
