import { AppHeader } from '@/components/navigation/app-header';
import { EmptyState, Screen } from '@/components/ui';

export default function ReportsScreen() {
  return (
    <Screen header={<AppHeader />}>
      <EmptyState
        icon="document-text-outline"
        title="No reports yet"
        message="Your monthly financial reports will appear here once your accountant publishes them."
      />
    </Screen>
  );
}
