import { Laptop, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Menu } from '@/components/ui/Menu';
import { usePreferences } from '@/providers/PreferencesProvider';

export function LanguageToggle() {
  const { t } = useTranslation();
  const { locale, setLocale } = usePreferences();
  const next = locale === 'fa' ? 'en' : 'fa';
  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      className="grid h-10 min-w-10 place-items-center rounded-lg px-2 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-fg"
      aria-label={t('settings.toggleLanguage')}
      title={t('settings.toggleLanguage')}
      lang={next}
    >
      {next === 'fa' ? 'فا' : 'EN'}
    </button>
  );
}

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, resolvedTheme, setTheme } = usePreferences();
  const Icon = theme === 'system' ? Laptop : resolvedTheme === 'dark' ? Moon : Sun;
  return (
    <Menu
      triggerLabel={t('settings.toggleTheme')}
      triggerClassName="size-10"
      trigger={<Icon className="size-5" />}
      items={[
        { label: t('settings.light'), icon: Sun, onSelect: () => setTheme('light') },
        { label: t('settings.dark'), icon: Moon, onSelect: () => setTheme('dark') },
        { label: t('settings.system'), icon: Laptop, onSelect: () => setTheme('system') },
      ]}
    />
  );
}
