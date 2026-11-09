import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Panel } from '@/components/AppUI';
import { useColors } from '@/hooks/useColors';
import type { PotholeReport, Severity } from '@/types';

type Props = {
  reports: PotholeReport[];
  region?: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  permissionGranted?: boolean;
};

export function MapSurface({ reports }: Props) {
  const colors = useColors();
  return (
    <Panel style={styles.map}>
      <AppText size={15} weight="semibold">Interactive map is available in the phone app</AppText>
      <AppText size={12} tone="muted">Reports stay available in the list below.</AppText>
      {reports.length === 0 ? <AppText size={11} tone="muted">No reports match these filters.</AppText> : null}
      <View style={styles.legend}>
        {(['Low', 'Medium', 'High', 'Critical'] as Severity[]).map((item) => (
          <View key={item} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: { Low: colors.warning, Medium: '#FF8A3D', High: colors.primary, Critical: colors.foreground }[item] }]} />
            <AppText size={10} tone="muted">{item}</AppText>
          </View>
        ))}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  map: { minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 22 },
  legend: { flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
