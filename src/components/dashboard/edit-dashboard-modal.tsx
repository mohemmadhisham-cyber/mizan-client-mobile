import { Modal, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Text } from '@/components/ui';
import { DASHBOARD_SECTION_LABEL, type DashboardSection, type DashboardVisibility } from '@/lib/dashboard-prefs';
import { spacing, useTheme } from '@/theme';

const SECTIONS: DashboardSection[] = ['cashFlow', 'criticalTasks', 'thisMonth', 'whatChanged', 'expenseTrend'];

interface EditDashboardModalProps {
  visible: boolean;
  sectionVisibility: DashboardVisibility;
  onToggle: (section: DashboardSection) => void;
  onDone: () => void;
}

export function EditDashboardModal({ visible, sectionVisibility, onToggle, onDone }: EditDashboardModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDone}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <Card
          elevated
          padded={false}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: insets.bottom + spacing.lg }}>
          <View style={{ padding: spacing.base, gap: 2 }}>
            <Text variant="title">Edit Dashboard</Text>
            <Text variant="footnote" color="mutedForeground">
              Choose which sections appear on your Home screen.
            </Text>
          </View>
          {SECTIONS.map((s, i) => (
            <View
              key={s}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: spacing.base,
                paddingVertical: spacing.md,
                borderTopWidth: i === 0 ? 1 : 0,
                borderTopColor: theme.colors.border,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}>
              <Text variant="body">{DASHBOARD_SECTION_LABEL[s]}</Text>
              <Switch
                value={sectionVisibility[s]}
                onValueChange={() => onToggle(s)}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              />
            </View>
          ))}
          <View style={{ padding: spacing.base }}>
            <Button title="Done" onPress={onDone} fullWidth />
          </View>
        </Card>
      </View>
    </Modal>
  );
}
