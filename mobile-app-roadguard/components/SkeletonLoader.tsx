import React, { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

export function SkeletonBlock({ width = '100%', height = 12, style }: { width?: DimensionValue; height?: number; style?: ViewStyle }) {
  const colors = useColors();
  const opacity = useSharedValue(0.46);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 850 }), -1, true);
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.block, { width, height, backgroundColor: colors.secondary }, style, animatedStyle]} />;
}

export function SkeletonReportCard() {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SkeletonBlock width={40} height={40} style={styles.circle} />
      <View style={styles.copy}>
        <SkeletonBlock width="62%" height={11} />
        <SkeletonBlock width="88%" height={9} />
        <SkeletonBlock width="40%" height={8} />
      </View>
      <SkeletonBlock width={28} height={28} style={styles.circle} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: 7 },
  circle: { borderRadius: 14 },
  card: { minHeight: 82, borderWidth: 1, borderRadius: 17, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  copy: { flex: 1, gap: 8 },
});
