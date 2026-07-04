import { LegalDocView } from '@/components/legal/legal-doc-view';
import { TERMS_OF_SERVICE_SECTIONS } from '@/services/legal-content';

export default function TermsOfServiceScreen() {
  return <LegalDocView title="Terms of Service" sections={TERMS_OF_SERVICE_SECTIONS} />;
}
