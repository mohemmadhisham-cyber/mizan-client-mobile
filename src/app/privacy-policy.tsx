import { useTranslation } from 'react-i18next';
import { LegalDocView } from '@/components/legal/legal-doc-view';
import { PRIVACY_POLICY_SECTIONS } from '@/services/legal-content';

export default function PrivacyPolicyScreen() {
  const { t } = useTranslation();
  return <LegalDocView title={t('settings.privacyPolicy')} sections={PRIVACY_POLICY_SECTIONS} />;
}
