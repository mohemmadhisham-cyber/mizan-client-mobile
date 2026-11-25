import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Badge, Card, Text } from '@/components/ui';
import type { AccountantRequest } from '@/services/accountant-requests';
import { spacing, useTheme } from '@/theme';

import { requestOneLine, requestSentLine, requestTitle } from './request-text';

interface RequestCardProps {
  request: AccountantRequest;
  onPress: () => void;
}

/** One request waiting for the owner's answer, as a row in the Action Center. */
export function RequestCard({ request, onPress }: RequestCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const title = requestTitle(request);
  const sentLine = requestSentLine(request, t);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${t('tasks.needsApproval')}`} onPress={onPress}>
      <Card elevated style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
          <Text variant="callout" weight="semibold" numberOfLines={2} style={{ flex: 1 }}>
            {title}
          </Text>
          <Badge label={t('tasks.needsApproval')} bg={theme.colors.warningSoft} fg={theme.colors.warningSoftForeground} />
        </View>
        {sentLine ? (
          <Text variant="footnote" color="mutedForeground">
            {sentLine}
          </Text>
        ) : null}
        <Text variant="callout" tabular>
          {requestOneLine(request, t)}
        </Text>
      </Card>
    </Pressable>
  );
}
