import { Link } from 'react-router-dom';
import { useLang } from '../i18n/i18n';
import { Card, TopBar } from '../components/ui';

export default function NotFound() {
  const { t } = useLang();
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-[18px] pb-6 pt-3.5">
      <TopBar />
      <Card className="mt-10 p-7 text-center">
        <p className="text-[16px] font-medium">{t('err.not_found')}</p>
        <Link to="/" className="mt-4 inline-flex min-h-[44px] items-center font-medium text-accent">
          {t('status.goHome')}
        </Link>
      </Card>
    </main>
  );
}
