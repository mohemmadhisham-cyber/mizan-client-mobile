import { LegalDocView } from '@/components/legal/legal-doc-view';
import { PRIVACY_POLICY_SECTIONS } from '@/services/legal-content';

export default function PrivacyPolicyScreen() {
  return <LegalDocView title="Privacy Policy" sections={PRIVACY_POLICY_SECTIONS} />;
}
