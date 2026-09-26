import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STATUS_STYLE, APPLICATION_STATUSES, type ApplicationStatus } from '@/lib/domain';
import { cn } from '@/lib/utils';
import { useFormat } from '@/providers/PreferencesProvider';
import type { ApplicationWithDetails } from './api';
import { ApplicationCard } from './ApplicationCard';

function DraggableCard({
  app,
  onMove,
}: {
  app: ApplicationWithDetails;
  onMove: (id: string, status: ApplicationStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: app.id,
    data: { status: app.status },
  });
  return (
    <div ref={setNodeRef} className={cn('touch-manipulation', isDragging && 'opacity-40')}>
      <ApplicationCard
        app={app}
        onMove={(status) => onMove(app.id, status)}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function Column({
  status,
  apps,
  onMove,
}: {
  status: ApplicationStatus;
  apps: ApplicationWithDetails[];
  onMove: (id: string, status: ApplicationStatus) => void;
}) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={t(`enums.status.${status}`)}
      className={cn(
        'flex w-72 shrink-0 snap-start flex-col rounded-2xl border border-t-4 border-border bg-surface-2/60 transition-colors',
        STATUS_STYLE[status].column,
        isOver && 'bg-primary-soft ring-2 ring-primary/30',
      )}
    >
      <header className="flex items-center justify-between px-3 pt-3 pb-2">
        <h2 className="text-sm font-semibold">{t(`enums.status.${status}`)}</h2>
        <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
          {fmt.number(apps.length)}
        </span>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-3">
        {apps.map((app) => (
          <DraggableCard key={app.id} app={app} onMove={onMove} />
        ))}
        {apps.length === 0 && (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">
            —
          </div>
        )}
      </div>
    </section>
  );
}

/** Kanban board by status: drag cards between columns (or use each card's menu). */
export function KanbanBoard({
  apps,
  onMove,
}: {
  apps: ApplicationWithDetails[];
  onMove: (id: string, status: ApplicationStatus) => void;
}) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const active = apps.find((a) => a.id === activeId) ?? null;

  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));
  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const target = event.over?.id as ApplicationStatus | undefined;
    const from = event.active.data.current?.status as ApplicationStatus | undefined;
    if (target && target !== from) onMove(String(event.active.id), target);
  };

  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t('applications.dragHint')}</p>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="scrollbar-thin -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {APPLICATION_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              apps={apps.filter((a) => a.status === status)}
              onMove={onMove}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? <ApplicationCard app={active} dragging className="w-68" /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
