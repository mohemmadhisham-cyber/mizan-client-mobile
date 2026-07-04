import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/navigation/detail-header';
import { Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

interface LegalDocViewProps {
  title: string;
  sections: { heading: string; body: string }[];
}

export function LegalDocView({ title, sections }: LegalDocViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <DetailHeader title={title} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        {sections.map((s) => (
          <View key={s.heading} style={{ gap: spacing.xs }}>
            <Text variant="title">{s.heading}</Text>
            <Text variant="callout" color="mutedForeground">
              {s.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
