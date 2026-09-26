import { Download, FileJson, FileSpreadsheet, Upload } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { useApplications, useCreateApplication } from '@/features/applications/api';
import { useMyRooms } from '@/features/rooms/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { describeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { downloadFile, toAsciiDigits } from '@/lib/utils';
import { useToast } from '@/providers/ToastProvider';
import Papa from 'papaparse';
import { applicationsToCsv, csvTemplate, parseApplicationsCsv, type ImportRow } from './csv';

const stamp = () => new Date().toISOString().slice(0, 10);

async function loadRoomExport(roomId: string) {
  const q = async <T,>(p: PromiseLike<{ data: T; error: unknown }>) => {
    const { data, error } = await p;
    if (error) throw error;
    return data;
  };
  const [room, members, applications, targets, notes, comments, files, activity] =
    await Promise.all([
      q(supabase.from('rooms').select('*').eq('id', roomId).single()),
      q(
        supabase
          .from('room_members')
          .select('role, joined_at, profile:profiles!room_members_user_id_fkey(display_name)')
          .eq('room_id', roomId),
      ),
      q(supabase.rpc('get_room_applications', { p_room_id: roomId })),
      q(
        supabase
          .from('room_targets')
          .select('*, room_target_votes(user_id, interest)')
          .eq('room_id', roomId),
      ),
      q(supabase.from('notes').select('*').eq('room_id', roomId)),
      q(supabase.from('comments').select('*').eq('room_id', roomId)),
      q(
        supabase
          .from('attachments')
          .select('file_name, mime_type, size_bytes, description, created_at')
          .eq('room_id', roomId),
      ),
      q(
        supabase
          .from('activity_log')
          .select('action, entity_type, metadata, created_at')
          .eq('room_id', roomId)
          .order('created_at'),
      ),
    ]);
  return {
    exported_at: new Date().toISOString(),
    room,
    members,
    applications,
    targets,
    notes,
    comments,
    files,
    activity,
  };
}

export default function DataPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('data.title'));
  const toast = useToast();
  const [params] = useSearchParams();
  const { data: apps = [] } = useApplications();
  const { data: rooms = [] } = useMyRooms();
  const create = useCreateApplication();
  const [roomId, setRoomId] = useState(params.get('room') ?? '');
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedRoom = roomId || rooms[0]?.id || '';
  const valid = rows?.filter((r) => r.input) ?? [];
  const invalid = rows?.filter((r) => r.error) ?? [];

  const exportRoom = async (format: 'json' | 'csv') => {
    if (!selectedRoom) return;
    setBusy(true);
    try {
      const data = await loadRoomExport(selectedRoom);
      const name = `applyhub-room-${stamp()}`;
      if (format === 'json')
        downloadFile(`${name}.json`, JSON.stringify(data, null, 2), 'application/json');
      else
        downloadFile(
          `${name}.csv`,
          '﻿' + Papa.unparse(data.applications as object[]),
          'text/csv;charset=utf-8',
        );
      toast.success(t('data.exported'));
    } catch (e) {
      toast.error(describeError(e, t));
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setBusy(true);
    let count = 0;
    try {
      for (const row of valid) {
        await create.mutateAsync(row.input!);
        count += 1;
      }
      toast.success(t('data.imported', { count }));
      setRows(null);
    } catch (e) {
      toast.error(describeError(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('data.title')} description={t('data.subtitle')} />
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader
            title={t('data.exportApplications')}
            description={t('data.exportApplicationsBody')}
          />
          <CardBody className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                downloadFile(
                  `applyhub-applications-${stamp()}.json`,
                  JSON.stringify(apps, null, 2),
                  'application/json',
                )
              }
            >
              <FileJson className="size-4" aria-hidden />
              {t('data.downloadJson')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadFile(
                  `applyhub-applications-${stamp()}.csv`,
                  applicationsToCsv(apps),
                  'text/csv;charset=utf-8',
                )
              }
            >
              <FileSpreadsheet className="size-4" aria-hidden />
              {t('data.downloadCsv')}
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('data.exportRooms')} description={t('data.exportRoomsBody')} />
          <CardBody className="flex flex-wrap items-center gap-2">
            <Select
              className="w-auto min-w-48"
              value={selectedRoom}
              onChange={(e) => setRoomId(e.target.value)}
              aria-label={t('data.chooseRoom')}
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id!}>
                  {r.name}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              disabled={!selectedRoom}
              loading={busy}
              onClick={() => void exportRoom('json')}
            >
              <FileJson className="size-4" aria-hidden />
              {t('data.downloadJson')}
            </Button>
            <Button
              variant="outline"
              disabled={!selectedRoom || busy}
              onClick={() => void exportRoom('csv')}
            >
              <FileSpreadsheet className="size-4" aria-hidden />
              {t('data.downloadCsv')}
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('data.importTitle')} description={t('data.importBody')} />
          <CardBody className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() =>
                  downloadFile('applyhub-template.csv', csvTemplate(), 'text/csv;charset=utf-8')
                }
              >
                <Download className="size-4" aria-hidden />
                {t('data.downloadTemplate')}
              </Button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2">
                <Upload className="size-4" aria-hidden />
                {t('data.chooseFile')}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setRows(parseApplicationsCsv(toAsciiDigits(await file.text())));
                    } catch {
                      toast.error(t('data.parseError'));
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {rows && (
              <>
                <Alert tone={invalid.length ? 'warning' : 'success'}>
                  {t('data.previewRows', { count: valid.length })}
                  {invalid.length > 0 && <> · {t('data.invalidRows', { count: invalid.length })}</>}
                </Alert>
                {invalid.length > 0 && (
                  <ul className="max-h-40 overflow-auto text-xs text-danger">
                    {invalid.map((r) => (
                      <li key={r.line}>
                        {t('data.row', { row: r.line })}: {r.error}
                      </li>
                    ))}
                  </ul>
                )}
                {valid.length > 0 && (
                  <ul className="max-h-48 overflow-auto text-sm">
                    {valid.map((r) => (
                      <li key={r.line} className="truncate" dir="auto">
                        {r.input!.application.university_name} · {r.input!.application.program_name}
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  className="self-start"
                  disabled={valid.length === 0}
                  loading={busy}
                  onClick={() => void runImport()}
                >
                  {t('data.importButton', { count: valid.length })}
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
