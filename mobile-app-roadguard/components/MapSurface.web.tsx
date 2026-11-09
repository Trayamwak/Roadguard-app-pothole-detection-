import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Panel } from '@/components/AppUI';
import { useColors } from '@/hooks/useColors';
import type { PotholeReport, Severity } from '@/types';

function pinColor(severity: Severity) {
  return { Low: '#F4B740', Medium: '#FF8A3D', High: '#E10600', Critical: '#111111' }[severity];
}

export function MapSurface({ reports }: { reports: PotholeReport[] }) {
  const colors = useColors();
  return (
    <Panel style={styles.webMap}>
      <View style={styles.mapIcon}><Ionicons name="map-outline" size={27} color={colors.accent} /></View>
      <AppText size={15} weight="semibold">Interactive map is available in the phone app</AppText>
      <AppText size={12} tone="muted" style={styles.centered}>
        This web preview can filter reports and open their details. The native map uses your device’s map provider.
      </AppText>
      {reports.length === 0 ? <AppText size={11} tone="muted">No reports match these filters.</AppText> : null}
      <View style={styles.legend}>
        {(['Low', 'Medium', 'High', 'Critical'] as Severity[]).map((item) => (
          <View key={item} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: pinColor(item) }]} />
            <AppText size={10} tone="muted">{item}</AppText>
          </View>
        ))}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  webMap: { minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 22 },
  mapIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#2A1A13', alignItems: 'center', justifyContent: 'center' },
  centered: { textAlign: 'center', lineHeight: 18, maxWidth: 320 },
  legend: { flexDirection: 'row', gap: 12, marginTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
});
