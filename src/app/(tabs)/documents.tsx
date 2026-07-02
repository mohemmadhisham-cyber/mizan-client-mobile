import { EmptyState, Screen } from '@/components/ui';

export default function DocumentsScreen() {
  return (
    <Screen>
      <EmptyState
        icon="camera-outline"
        title="Capture your first receipt"
        message="Photograph a receipt and we'll extract the details for your accountant to review."
        actionLabel="Upload a receipt"
        onAction={() => {}}
      />
    </Screen>
  );
}
