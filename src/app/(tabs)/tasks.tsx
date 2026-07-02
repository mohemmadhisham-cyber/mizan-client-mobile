import { AppHeader } from '@/components/navigation/app-header';
import { EmptyState, Screen } from '@/components/ui';

export default function TasksScreen() {
  return (
    <Screen header={<AppHeader />}>
      <EmptyState
        icon="checkmark-done-outline"
        title="You're all caught up"
        message="Questions and approvals from your accountant will show up here."
      />
    </Screen>
  );
}
