import { AppHeader } from '@/components/navigation/app-header';
import { EmptyState, Screen } from '@/components/ui';

export default function AiAdvisorScreen() {
  return (
    <Screen header={<AppHeader />}>
      <EmptyState
        icon="sparkles-outline"
        title="AI Advisor"
        message="Ask questions about your finances — your AI CFO lands here (token-metered)."
      />
    </Screen>
  );
}
