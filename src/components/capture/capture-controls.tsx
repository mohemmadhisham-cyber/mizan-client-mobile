import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cameraChrome } from '@/theme';

type Mode = 'single' | 'batch';

interface CaptureControlsProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onGallery: () => void;
  onShutter: () => void;
  onManualEntry: () => void;
  onUploadFromLibrary: () => void;
  shutterDisabled?: boolean;
}

const haptic = () => {
  if (process.env.EXPO_OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
};

export function CaptureControls({
  mode,
  onModeChange,
  onGallery,
  onShutter,
  onManualEntry,
  onUploadFromLibrary,
  shutterDisabled,
}: CaptureControlsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.modeRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'single' }}
          onPress={() => onModeChange('single')}
          style={styles.modePill}>
          <Text style={[styles.modeText, mode === 'single' && styles.modeTextActive]}>Single</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'batch' }}
          onPress={() => onModeChange('batch')}
          style={[styles.modePill, mode === 'batch' && styles.modePillActive]}>
          <Text style={[styles.modeText, mode === 'batch' && styles.modeTextActive]}>Batch</Text>
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose from gallery" onPress={onGallery} style={styles.squareButton}>
          <Ionicons name="images-outline" size={22} color={cameraChrome.foreground} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          disabled={shutterDisabled}
          onPress={() => {
            haptic();
            onShutter();
          }}
          style={({ pressed }) => [styles.shutterRing, pressed && { opacity: 0.85 }]}>
          <View style={styles.shutterInner} />
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel="Enter manually" onPress={onManualEntry} style={styles.squareButton}>
          <Ionicons name="keypad-outline" size={22} color={cameraChrome.foreground} />
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={onUploadFromLibrary}>
        <Text style={styles.libraryLink}>Upload from Library</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 16,
  },
  modePill: {
    paddingHorizontal: 17,
    paddingVertical: 9,
    borderRadius: 9999,
  },
  modePillActive: {
    backgroundColor: cameraChrome.pill,
    borderWidth: 1,
    borderColor: cameraChrome.pillBorder,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: cameraChrome.foregroundSubtle,
  },
  modeTextActive: {
    color: cameraChrome.foreground,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 384,
  },
  squareButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: cameraChrome.glassSubtle,
    borderWidth: 1,
    borderColor: cameraChrome.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRing: {
    width: 80,
    height: 80,
    borderRadius: 9999,
    borderWidth: 4,
    borderColor: cameraChrome.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 68,
    height: 68,
    borderRadius: 9999,
    backgroundColor: cameraChrome.foreground,
  },
  libraryLink: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: cameraChrome.foregroundSubtle,
  },
});
