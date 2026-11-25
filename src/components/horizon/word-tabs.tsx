import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { HORIZON_GUTTER } from './horizon-screen';

const TAB_HEIGHT = 46;
const TAB_GAP = 22;
const MARKER_HEIGHT = 2;
const PRESSED_OPACITY = 0.6;

interface WordTabsProps<K extends string> {
  options: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  /** What the set chooses between, for screen readers ("Category", "Year"). */
  accessibilityLabel?: string;
}

/**
 * A filter as a line of words on the ground. The chosen word is inked and
 * underlined; the others are quiet. No pills. The line scrolls sideways when
 * the words do not fit.
 */
export function WordTabs<K extends string>({ options, value, onChange, accessibilityLabel }: WordTabsProps<K>) {
  const theme = useTheme();
  return (
    <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }}>
      <ScrollView
        horizontal
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: HORIZON_GUTTER, gap: TAB_GAP }}>
        {options.map((option) => {
          const active = option.key === value;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(option.key)}
              // A short word ("All") is narrow: the gap on each side is part of its target.
              hitSlop={{ left: TAB_GAP / 2, right: TAB_GAP / 2 }}
              style={({ pressed }) => ({
                height: TAB_HEIGHT,
                justifyContent: 'center',
                opacity: pressed ? PRESSED_OPACITY : 1,
              })}>
              <Text
                variant="subhead"
                weight={active ? 'semibold' : 'regular'}
                style={{ color: active ? theme.colors.foreground : theme.colors.mutedForeground }}>
                {option.label}
              </Text>
              {active ? <View style={[styles.marker, { backgroundColor: theme.colors.foreground }]} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
    height: MARKER_HEIGHT,
  },
});
