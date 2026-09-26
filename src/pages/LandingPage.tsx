import { ArrowRight, BookOpenCheck, KanbanSquare, ShieldCheck, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '@/components/common/StatusBadge';
import { LinkButton } from '@/components/ui/Button';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { ApplicationStatus } from '@/lib/domain';
import { useAuth } from '@/providers/AuthProvider';

const PREVIEW: { status: ApplicationStatus; cards: [string, string][] }[] = [
  {
    status: 'preparing',
    cards: [
      ['Uni A', 'MSc'],
      ['Uni B', 'PhD'],
    ],
  },
  { status: 'submitted', cards: [['Uni C', 'MSc']] },
  { status: 'admitted', cards: [['Uni D', 'MSc']] },
];

export default function LandingPage() {
  const { t } = useTranslation();
  useDocumentTitle(null);
  const { user } = useAuth();

  const features = [
    {
      icon: KanbanSquare,
      title: t('landing.featureTrackerTitle'),
      body: t('landing.featureTrackerBody'),
    },
    { icon: Users, title: t('landing.featureRoomsTitle'), body: t('landing.featureRoomsBody') },
    { icon: BookOpenCheck, title: t('landing.featureKbTitle'), body: t('landing.featureKbBody') },
    {
      icon: ShieldCheck,
      title: t('landing.featurePrivacyTitle'),
      body: t('landing.featurePrivacyBody'),
    },
  ];

  return (
    <div className="flex flex-col gap-16 py-4 sm:py-10">
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-5xl sm:leading-tight">
            {t('landing.heroTitle')}
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">
            {t('landing.heroSubtitle')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <LinkButton to="/dashboard" size="lg">
                {t('landing.goToDashboard')}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </LinkButton>
            ) : (
              <LinkButton to="/signup" size="lg">
                {t('landing.getStarted')}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </LinkButton>
            )}
            <LinkButton to="/countries" variant="outline" size="lg">
              {t('landing.browseCountries')}
            </LinkButton>
          </div>
        </div>

        <div aria-hidden className="relative">
          <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/15 via-transparent to-emerald-400/10 blur-2xl" />
          <div className="grid grid-cols-3 gap-3 rounded-2xl border border-border bg-surface p-4 shadow-xl">
            {PREVIEW.map((column) => (
              <div key={column.status} className="flex flex-col gap-2 rounded-xl bg-surface-2 p-2">
                <StatusBadge status={column.status} className="self-start" />
                {column.cards.map(([uni, degree]) => (
                  <div
                    key={uni}
                    className="rounded-lg border border-border bg-surface p-2 shadow-xs"
                  >
                    <div className="h-2 w-3/4 rounded bg-fg/15" />
                    <div className="mt-1.5 h-2 w-1/2 rounded bg-fg/10" />
                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
                      <span>{uni}</span>
                      <span>{degree}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-border bg-surface p-5 shadow-xs"
          >
            <div className="mb-3 grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
              <feature.icon className="size-5" aria-hidden />
            </div>
            <h2 className="font-semibold">{feature.title}</h2>
            <p className="mt-1 text-sm text-muted">{feature.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
