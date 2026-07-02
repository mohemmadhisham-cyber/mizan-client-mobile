import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { Button } from './button';
import { Text } from './text';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'sparkles-outline', title, message, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.full,
          backgroundColor: theme.colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={icon} size={32} color={theme.colors.primary} />
      </View>
      <Text variant="title" center>
        {title}
      </Text>
      {message ? (
        <Text variant="callout" color="mutedForeground" center>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.sm }}>
          <Button title={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
