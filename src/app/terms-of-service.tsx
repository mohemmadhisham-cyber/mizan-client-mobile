import { useTranslation } from 'react-i18next';
import { LegalDocView } from '@/components/legal/legal-doc-view';
import { TERMS_OF_SERVICE_SECTIONS } from '@/services/legal-content';

export default function TermsOfServiceScreen() {
  const { t } = useTranslation();
  return <LegalDocView title={t('settings.termsOfService')} sections={TERMS_OF_SERVICE_SECTIONS} />;
}
