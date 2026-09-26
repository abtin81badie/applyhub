import { BookOpen, ExternalLink, FileQuestion, Pencil, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { useIntakeLabel } from '@/components/common/IntakeText';
import { Markdown } from '@/components/common/Markdown';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/QueryState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button, LinkButton, buttonClasses } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/Spinner';
import { useCountryLookup } from '@/features/kb/countries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { APPLICATION_STATUSES, type ApplicationStatus } from '@/lib/domain';
import { describeError } from '@/lib/errors';
import { safeHttpUrl } from '@/lib/utils';
import { useConfirm } from '@/providers/ConfirmProvider';
import { useFormat } from '@/providers/PreferencesProvider';
import { useToast } from '@/providers/ToastProvider';
import { useApplication, useDeleteApplication, useUpdateApplication } from './api';
import { DeadlinesEditor } from './DeadlinesEditor';
import { RequirementsChecklist } from './RequirementsChecklist';
import { SharingCard } from './SharingCard';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-end font-medium break-words">{children}</dd>
    </div>
  );
}

export default function ApplicationDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const fmt = useFormat();
  const intake = useIntakeLabel();
  const countries = useCountryLookup();
  const { data: app, isPending, error, refetch } = useApplication(id);
  const update = useUpdateApplication();
  const remove = useDeleteApplication();
  useDocumentTitle(app?.university_name ?? t('applications.title'));

  if (isPending) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!app) {
    return (
      <EmptyState
        icon={FileQuestion}
        title={t('applications.notFound')}
        action={<LinkButton to="/applications">{t('nav.applications')}</LinkButton>}
      />
    );
  }

  const portal = safeHttpUrl(app.portal_url);

  const changeStatus = (status: ApplicationStatus) =>
    update.mutate(
      { id: app.id, patch: { status } },
      {
        onSuccess: () => toast.success(t('applications.statusChanged')),
        onError: (e) => toast.error(describeError(e, t)),
      },
    );

  const onDelete = async () => {
    const ok = await confirm({
      title: t('applications.deleteConfirmTitle'),
      body: t('applications.deleteConfirmBody'),
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    remove.mutate(app.id, {
      onSuccess: () => {
        toast.success(t('applications.deleted'));
        navigate('/applications', { replace: true });
      },
      onError: (e) => toast.error(describeError(e, t)),
    });
  };

  const intakeText = intake(app.intake_term, app.intake_year);

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link to="/applications" className="hover:text-fg">
            {t('nav.applications')}
          </Link>
        }
        title={app.university_name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {app.program_name && <span dir="auto">{app.program_name}</span>}
            <StatusBadge status={app.status} />
          </span>
        }
        actions={
          <>
            {portal && (
              <a
                href={portal}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses({ variant: 'outline' })}
              >
                <ExternalLink className="size-4" aria-hidden />
                {t('applications.detail.openPortal')}
              </a>
            )}
            <LinkButton to={`/applications/${app.id}/edit`} variant="outline">
              <Pencil className="size-4" aria-hidden />
              {t('common.edit')}
            </LinkButton>
            <Button variant="ghost" onClick={() => void onDelete()} aria-label={t('common.delete')}>
              <Trash2 className="size-4 text-danger" aria-hidden />
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <RequirementsChecklist app={app} />
          <DeadlinesEditor app={app} />
          <Card>
            <CardHeader
              title={t('applications.detail.notes')}
              description={t('applications.form.notesHint')}
            />
            <CardBody>
              {app.notes?.trim() ? (
                <Markdown>{app.notes}</Markdown>
              ) : (
                <p className="text-sm text-muted">{t('applications.detail.noNotes')}</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title={t('applications.detail.overview')} />
            <CardBody>
              <label className="mb-2 flex flex-col gap-1.5 text-sm">
                <span className="text-muted">{t('applications.form.status')}</span>
                <Select
                  value={app.status}
                  onChange={(e) => changeStatus(e.target.value as ApplicationStatus)}
                  disabled={update.isPending}
                >
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`enums.status.${s}`)}
                    </option>
                  ))}
                </Select>
              </label>
              <dl className="divide-y divide-border">
                <Fact label={t('applications.form.country')}>
                  {app.country_code
                    ? `${countries.flag(app.country_code)} ${countries.name(app.country_code)}`
                    : '—'}
                </Fact>
                <Fact label={t('applications.form.degree')}>
                  {app.degree_level ? t(`enums.degree.${app.degree_level}`) : '—'}
                </Fact>
                <Fact label={t('applications.columns.intake')}>{intakeText || '—'}</Fact>
                {app.submitted_at && (
                  <Fact label={t('applications.form.submittedAt')}>
                    {fmt.date(app.submitted_at)}
                  </Fact>
                )}
                <Fact label={t('applications.form.applicationFee')}>
                  {app.application_fee_amount !== null
                    ? fmt.money(app.application_fee_amount, app.application_fee_currency)
                    : '—'}
                </Fact>
                <Fact label={t('applications.form.tuition')}>
                  {app.tuition_amount !== null
                    ? `${fmt.money(app.tuition_amount, app.tuition_currency)}${app.tuition_period ? ` ${t(`enums.tuitionPeriod.${app.tuition_period}`)}` : ''}`
                    : '—'}
                </Fact>
              </dl>
              {app.funding_info && (
                <div className="mt-3 rounded-lg bg-surface-2 p-3 text-sm">
                  <p className="mb-1 text-xs font-medium text-muted">
                    {t('applications.form.fundingInfo')}
                  </p>
                  <p className="whitespace-pre-wrap" dir="auto">
                    {app.funding_info}
                  </p>
                </div>
              )}
              {(app.university_id || app.program_id) && (
                <Link
                  to={
                    app.program_id
                      ? `/programs/${app.program_id}`
                      : `/universities/${app.university_id}`
                  }
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <BookOpen className="size-4" aria-hidden />
                  {t('applications.detail.fromKb')}
                </Link>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('applications.detail.outcome')} />
            <CardBody>
              {app.result_date || app.decision_notes ? (
                <dl className="divide-y divide-border">
                  {app.result_date && (
                    <Fact label={t('applications.form.resultDate')}>
                      {fmt.date(app.result_date)}
                    </Fact>
                  )}
                  {app.decision_notes && (
                    <div className="py-2 text-sm">
                      <dt className="text-muted">{t('applications.form.decisionNotes')}</dt>
                      <dd className="mt-1 whitespace-pre-wrap" dir="auto">
                        {app.decision_notes}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-muted">{t('applications.detail.noOutcome')}</p>
              )}
            </CardBody>
          </Card>

          <SharingCard app={app} />
        </div>
      </div>
    </div>
  );
}
