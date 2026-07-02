import { AppHeader } from '@/components/navigation/app-header';
import { EmptyState, Screen } from '@/components/ui';

export default function ActivityScreen() {
  return (
    <Screen header={<AppHeader />}>
      <EmptyState
        icon="pulse-outline"
        title="Activity"
        message="Your recent account activity and action center will appear here."
      />
    </Screen>
  );
}
