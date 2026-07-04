import { View } from 'react-native';

import { radius, spacing } from '@/theme';

import { Text } from './text';

interface BadgeProps {
  label: string;
  bg: string;
  fg: string;
}

/**
 * Small status pill. `alignSelf: 'flex-start'` guards against the classic RN
 * flex-row bug where a badge stretches to match a taller sibling (e.g. a
 * multi-line title) when the parent row has no explicit `alignItems`.
 */
export function Badge({ label, bg, fg }: BadgeProps) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: radius.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
      }}>
      <Text variant="caption" weight="semibold" style={{ color: fg, letterSpacing: 0.6 }}>
        {label}
      </Text>
    </View>
  );
}
