import { Modal, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Card, Text } from '@/components/ui';
import { useAppLocked } from '@/hooks/use-app-lock';
import { DASHBOARD_SECTION_LABEL_KEY, type DashboardSection, type DashboardVisibility } from '@/lib/dashboard-prefs';
import { spacing, useTheme } from '@/theme';

const SECTIONS: DashboardSection[] = ['cashFlow', 'criticalTasks', 'thisMonth', 'whatChanged', 'expenseTrend'];

interface EditDashboardModalProps {
  visible: boolean;
  sectionVisibility: DashboardVisibility;
  onToggle: (section: DashboardSection) => void;
  onDone: () => void;
}

export function EditDashboardModal({ visible, sectionVisibility, onToggle, onDone }: EditDashboardModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const appLocked = useAppLocked();
  const insets = useSafeAreaInsets();

  return (
    // Closed while the app is locked: a sheet is drawn above the lock. It comes back as it was.
    <Modal visible={visible && !appLocked} animationType="slide" transparent onRequestClose={onDone}>
      <View style={{ flex: 1, backgroundColor: theme.colors.scrim, justifyContent: 'flex-end' }}>
        <Card
          elevated
          padded={false}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: insets.bottom + spacing.lg }}>
          <View style={{ padding: spacing.base, gap: 2 }}>
            <Text variant="title">{t('dashboard.editTitle')}</Text>
            <Text variant="footnote" color="mutedForeground">
              {t('dashboard.editBody')}
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
              <Text variant="body">{t(DASHBOARD_SECTION_LABEL_KEY[s])}</Text>
              <Switch
                value={sectionVisibility[s]}
                onValueChange={() => onToggle(s)}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              />
            </View>
          ))}
          <View style={{ padding: spacing.base }}>
            <Button title={t('common.done')} onPress={onDone} fullWidth />
          </View>
        </Card>
      </View>
    </Modal>
  );
}
