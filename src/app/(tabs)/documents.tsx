import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/navigation/app-header';
import { EmptyState, Screen } from '@/components/ui';

export default function DocumentsScreen() {
  const router = useRouter();
  return (
    <Screen header={<AppHeader />}>
      <EmptyState
        icon="camera-outline"
        title="Capture your first receipt"
        message="Photograph a receipt and we'll extract the details for your accountant to review."
        actionLabel="Photograph receipt"
        onAction={() => router.push('/capture')}
      />
    </Screen>
  );
}
