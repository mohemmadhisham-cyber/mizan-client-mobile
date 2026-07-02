import { EmptyState, Screen } from '@/components/ui';

export default function TasksScreen() {
  return (
    <Screen>
      <EmptyState
        icon="checkmark-done-outline"
        title="You're all caught up"
        message="Questions and approvals from your accountant will show up here."
      />
    </Screen>
  );
}
