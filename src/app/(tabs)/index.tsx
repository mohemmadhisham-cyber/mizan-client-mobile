import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Screen, Skeleton, Text } from '@/components/ui';
import { spacing } from '@/theme';

const KPI_KEYS = ['home.cash', 'home.moneyIn', 'home.moneyOut', 'home.profit'] as const;

export default function HomeScreen() {
  const { t } = useTranslation();
  return (
    <Screen scroll>
      <View style={{ gap: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.lg }}>
        <Text variant="footnote" color="mutedForeground">
          {t('common.appName')}
        </Text>
        <Text variant="h1">{t('home.greeting', { name: 'Sarah' })}</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {KPI_KEYS.map((key) => (
          <Card key={key} elevated style={{ flexBasis: '47%', flexGrow: 1, gap: spacing.sm }}>
            <Text variant="footnote" color="mutedForeground">
              {t(key)}
            </Text>
            <Skeleton width="70%" height={26} />
          </Card>
        ))}
      </View>
    </Screen>
  );
}
