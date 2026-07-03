import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/use-reduced-motion';

const MINT = '#6BFE9C';
const CORNER = 32;

/**
 * Figma "Capture Receipt" viewfinder reticle: dashed frame, mint corner
 * markers, an animated scan line, and an "Auto-detect active" badge. Camera
 * chrome uses fixed colors (not the app theme) — matches how camera UIs in
 * most apps stay dark regardless of the app's light/dark setting.
 */
export function ScanningReticle() {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    progress.value = withRepeat(withTiming(1, { duration: 2200 }), -1, true);
  }, [reduced, progress]);

  const lineStyle = useAnimatedStyle(() => ({
    top: `${progress.value * 100}%`,
    opacity: reduced ? 0 : 1,
  }));

  return (
    <View style={styles.frame}>
      <View style={[styles.corner, styles.topLeft]} />
      <View style={[styles.corner, styles.topRight]} />
      <View style={[styles.corner, styles.bottomLeft]} />
      <View style={[styles.corner, styles.bottomRight]} />
      <Animated.View style={[styles.scanLine, lineStyle]} />
      <View style={styles.badge}>
        <View style={styles.badgeDot} />
        <Animated.Text style={styles.badgeText}>AUTO-DETECT ACTIVE</Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 3 / 4,
    width: '100%',
    maxWidth: 384,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: MINT,
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: MINT,
    shadowColor: MINT,
    shadowRadius: 10,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  badge: {
    position: 'absolute',
    bottom: -20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(107,254,156,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(107,254,156,0.3)',
    borderRadius: 9999,
    paddingHorizontal: 13,
    paddingVertical: 5,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: MINT,
  },
  badgeText: {
    color: MINT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
