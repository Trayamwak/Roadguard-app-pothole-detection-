import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import MapView, { Callout, Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Panel, SeverityBadge } from '@/components/AppUI';
import { useColors } from '@/hooks/useColors';
import type { PotholeReport, Severity } from '@/types';

const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#171717' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#A3A3A3' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#101010' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#292929' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111111' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8D8D8D' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#101820' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1C1C1C' }] },
];

function pinColor(severity: Severity) {
  return { Low: '#F4B740', Medium: '#FF8A3D', High: '#E10600', Critical: '#111111' }[severity];
}

export function MapSurface({
  reports,
  region,
  permissionGranted,
}: {
  reports: PotholeReport[];
  region: Region;
  permissionGranted: boolean;
}) {
  const colors = useColors();
  const [selected, setSelected] = useState<PotholeReport | null>(null);
  return (
    <View style={[styles.mapFrame, { borderColor: colors.border }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={Platform.OS !== 'ios' || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        customMapStyle={mapStyle}
        showsUserLocation={permissionGranted}
        showsMyLocationButton={false}
        onPress={() => setSelected(null)}
      >
        {reports.map((report) => (
          <Marker
            key={report.id}
            coordinate={{ latitude: report.lat, longitude: report.lng }}
            pinColor={pinColor(report.severity)}
            onPress={() => setSelected(report)}
            onCalloutPress={() => router.push({ pathname: '/report/[id]', params: { id: report.id } })}
          >
            <Callout onPress={() => router.push({ pathname: '/report/[id]', params: { id: report.id } })}>
              <View style={styles.callout}>
                <AppText size={13} weight="bold">{report.severity} pothole</AppText>
                <AppText size={11} tone="muted">{report.note || 'Tap to view details'}</AppText>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
      <Panel style={styles.mapLegend}>
        <AppText size={10} tone="muted" weight="semibold">SEVERITY</AppText>
        <View style={styles.legendItems}>
          {(['Low', 'Medium', 'High', 'Critical'] as Severity[]).map((item) => (
            <View key={item} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: pinColor(item) }]} />
              <AppText size={9} tone="muted">{item}</AppText>
            </View>
          ))}
        </View>
      </Panel>
      {selected ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${selected.severity} pothole report`}
          onPress={() => router.push({ pathname: '/report/[id]', params: { id: selected.id } })}
          style={[styles.selectedCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <SeverityBadge severity={selected.severity} />
          <AppText size={12} weight="semibold" numberOfLines={1} style={styles.selectedNote}>{selected.note || 'Pothole report'}</AppText>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mapFrame: { flex: 1, minHeight: 290, borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  mapLegend: { position: 'absolute', top: 12, left: 12, padding: 10, gap: 8 },
  legendItems: { flexDirection: 'row', gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  selectedCard: { position: 'absolute', left: 10, right: 10, bottom: 10, minHeight: 58, borderRadius: 16, borderWidth: 1, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectedNote: { flex: 1 },
  callout: { maxWidth: 170, gap: 4, padding: 3 },
});
